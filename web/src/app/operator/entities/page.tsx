"use client";

import Link from "next/link";
import { useState } from "react";
import { Empty, Select, Top } from "@/components/app/primitives";
import { useToast } from "@/components/app/Toast";
import { Button, EntityValue, ScamTypeTag, StatusBadge, TraceHops } from "@/components/ui";
import { ENTITY_TYPES, SCAM_LABEL, TYPE_LABEL } from "@/lib/mock";
import type { EntityType } from "@/lib/types";
import { downloadCsv } from "@/lib/utils";
import { personaName, useOps } from "../store";

const squash = (s: string) => s.toLowerCase().replace(/\s/g, "");

export default function OpsEntitiesPage() {
  const { entities, convos, personas } = useOps();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [et, setEt] = useState<EntityType | "all">("all");
  const [sel, setSel] = useState(entities[4].id);

  const rows = entities.filter(
    (e) => (et === "all" || e.type === et) && (!query || squash(e.value + " " + (e.display || "")).includes(squash(query))),
  );
  const e = entities.find((x) => x.id === sel);
  const convo = e && convos.find((c) => c.id === e.convo);

  function exportCsv() {
    const ok = downloadCsv(
      rows.map((r) => ({ type: r.type, value: r.value, bank_or_chain: r.bank || "", scam_type: r.scam_type, confidence: r.confidence, sightings: r.sightings, status: r.status })),
      "entities.csv",
    );
    toast(ok ? `Exported ${rows.length} rows to entities.csv` : "Export blocked in this preview");
  }

  return (
    <>
      <Top
        title="Entities"
        sub={entities.length + " entities in the intel database. Every one traces back to its source conversation."}
        actions={
          <Button variant="secondary" onClick={exportCsv}>
            Export CSV
          </Button>
        }
      />
      <div className="bar">
        <input
          className="uk-input min-w-[200px] flex-1"
          value={query}
          onChange={(ev) => setQuery(ev.target.value)}
          placeholder="Search account, wallet, phone, URL…"
          aria-label="Search entities"
        />
        <Select
          label="Entity type"
          value={et}
          onChange={setEt}
          options={[["all", "All types"], ...ENTITY_TYPES.map((k) => [k, TYPE_LABEL[k]] as [EntityType, string])]}
        />
      </div>
      <div className="split grid-cols-[1.3fr_1fr]">
        <div className="uk-table-wrap">
          <table className="uk-table">
            <thead>
              <tr>
                {["Entity", "Scam type", "Seen", "Status"].map((c) => (
                  <th key={c}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={"click" + (r.id === sel ? " sel" : "")} onClick={() => setSel(r.id)}>
                  <td>
                    <EntityValue type={r.type} value={r.value} bank={r.bank} display={r.display} copyable={false} />
                  </td>
                  <td>
                    <ScamTypeTag type={r.scam_type} />
                  </td>
                  <td className="uk-mono">{r.sightings}×</td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {e ? (
          <div className="col">
            <div className="uk-card">
              <div className="uk-card-hd">
                <h3>{TYPE_LABEL[e.type]}</h3>
                <StatusBadge status={e.status} />
              </div>
              <div className="uk-card-bd col">
                <EntityValue type={e.type} value={e.value} bank={e.bank} display={e.display} />
                <dl className="kv">
                  <dt>Confidence</dt>
                  <dd className="uk-mono">{Math.round(e.confidence * 100)}%</dd>
                  <dt>Scam type</dt>
                  <dd>{SCAM_LABEL[e.scam_type]}</dd>
                  <dt>First seen</dt>
                  <dd>{e.first_seen}</dd>
                  <dt>Last seen</dt>
                  <dd>{e.last_seen}</dd>
                  <dt>Sightings</dt>
                  <dd className="uk-mono">{e.sightings}</dd>
                </dl>
              </div>
            </div>
            {e.type === "wallet" ? (
              <div className="col">
                <div className="sec">
                  <h2>On-chain trace</h2>
                </div>
                <TraceHops
                  wallet={e.value}
                  walletDisplay={e.display}
                  chain={e.bank}
                  hops={[
                    { depth: 1, to: "TLm4…8sQe", amount: "12,400.00" },
                    { depth: 2, to: "TBA6…kP2r", amount: "12,350.00", label: "Binance deposit" },
                    { depth: 1, to: "TXr1…Vd7c", amount: "3,050.00" },
                  ]}
                />
              </div>
            ) : null}
            <div className="col">
              <div className="sec">
                <h2>Audit trail</h2>
              </div>
              <div className="uk-card uk-card-bd">
                <ul className="timeline">
                  <li>
                    <time>{e.first_seen}</time>
                    <span>
                      First extracted from <Link href="/operator/live-chats">{convo ? convo.scammer : "conversation"}</Link> by persona{" "}
                      {convo ? personaName(personas, convo.persona) : ""}
                    </span>
                  </li>
                  {e.sightings > 1 ? (
                    <li>
                      <time>since</time>
                      <span>{e.sightings - 1} more sightings across conversations</span>
                    </li>
                  ) : null}
                  {e.status !== "unverified" ? (
                    <li>
                      <time>{e.last_seen}</time>
                      <span>{e.status === "verified" ? "Verified" : "Rejected"} by operator</span>
                    </li>
                  ) : (
                    <li>
                      <time>pending</time>
                      <span>Waiting in the verification queue</span>
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <Empty>Select an entity</Empty>
        )}
      </div>
    </>
  );
}
