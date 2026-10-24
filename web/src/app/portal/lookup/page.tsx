"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Select, Top } from "@/components/app/primitives";
import { Button, EntityValue, LookupResult, StatTile, StatusBadge } from "@/components/ui";
import { ENTITIES, ENTITY_TYPES, MY_BANK, TYPE_LABEL } from "@/lib/mock";
import type { EntityType, LookupResultData } from "@/lib/types";
import { usePortal } from "../store";

const norm = (v: string) => v.toLowerCase().replace(/[\s-]/g, "");

// Mock of POST /v1/lookup
function findEntity(type: EntityType, value: string) {
  return ENTITIES.filter((e) => e.status !== "rejected").find(
    (e) => e.type === type && (norm(e.value) === norm(value) || norm(e.display || "") === norm(value)),
  );
}

interface Run {
  q: { type: EntityType; value: string; bank?: string };
  res: LookupResultData;
  ms: number;
}
interface Hist {
  type: EntityType;
  value: string;
  match: boolean;
  ms: number;
  at: string;
}

export default function LookupPage() {
  const router = useRouter();
  const { lookups, bump } = usePortal();
  const [type, setType] = useState<EntityType>("bank_account");
  const [val, setVal] = useState("1140 2201 8837");
  const [res, setRes] = useState<Run | null>(null);
  const [hist, setHist] = useState<Hist[]>([]);

  function run(e?: FormEvent) {
    e?.preventDefault();
    if (!val.trim()) return;
    const en = findEntity(type, val);
    const ms = 14 + Math.round(Math.random() * 40);
    const out: LookupResultData = en
      ? { match: true, confidence: en.status === "verified" ? "high" : "medium", scam_types: [en.scam_type], first_seen: "2026-09-02T10:14:00Z", last_seen: "2026-10-22T08:41:00Z", sightings: en.sightings }
      : { match: false };
    setRes({ q: { type, value: val, bank: type === "bank_account" ? MY_BANK : type === "wallet" ? "TRON" : undefined }, res: out, ms });
    setHist((h) => [{ type, value: val, match: out.match, ms, at: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }) }, ...h].slice(0, 8));
    bump();
  }

  // Run the sample lookup once on first load.
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <Top
        over="Customer portal"
        title="Lookup"
        sub="The same check your payment system runs through POST /v1/lookup."
        actions={
          <Button variant="secondary" onClick={() => router.push("/portal/api-keys")}>
            API docs
          </Button>
        }
      />
      <div className="stats">
        <StatTile label="Lookups this month" value={lookups.toLocaleString("en-US")} detail="of 100k plan" progress={lookups / 1000} />
        <StatTile label="Matches" value="312" delta="+9%" detail="vs Sep" />
        <StatTile label="Confirmed fraud" value="89%" detail="precision · target 85%" />
        <StatTile label="Lookup p95" value="212 ms" detail="budget 300 ms" />
      </div>
      <div className="split">
        <div className="col">
          <div className="sec">
            <h2>Check an entity</h2>
          </div>
          <form className="bar flex-nowrap" onSubmit={run}>
            <Select
              label="Entity type"
              value={type}
              onChange={setType}
              options={ENTITY_TYPES.map((k) => [k, TYPE_LABEL[k]] as [EntityType, string])}
            />
            <input
              className="uk-input flex-1"
              value={val}
              onChange={(e) => setVal(e.target.value)}
              aria-label="Value"
              placeholder="Account number, wallet, phone or URL"
            />
            <Button variant="primary" type="submit">
              Run lookup
            </Button>
          </form>
          <div className="uk-muted text-xs">
            Try <code className="inl">1140 2201 8837</code> (verified), <code className="inl">5621 0384 1192</code> (unverified) or any other
            value for no match.
          </div>
          {res ? <LookupResult query={res.q} result={res.res} latency={res.ms} /> : null}
        </div>
        <div className="col">
          <div className="sec">
            <h2>Recent lookups</h2>
            <span className="uk-muted text-xs">this session</span>
          </div>
          <div className="uk-table-wrap">
            <table className="uk-table">
              <thead>
                <tr>
                  {["Time", "Entity", "Result", "Latency"].map((c) => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hist.map((x, i) => (
                  <tr key={i}>
                    <td className="uk-mono uk-muted text-xs">{x.at}</td>
                    <td>
                      <EntityValue type={x.type} value={x.value} copyable={false} />
                    </td>
                    <td>
                      <StatusBadge status={x.match ? "match" : "clear"} />
                    </td>
                    <td className="uk-mono">{x.ms} ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
