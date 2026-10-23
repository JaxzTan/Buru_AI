"use client";

import { useState } from "react";
import { Empty, Select, Tabs, Top } from "@/components/app/primitives";
import { useToast } from "@/components/app/Toast";
import { Button, EntityTable } from "@/components/ui";
import { ENTITY_TYPES, SCAM_LABEL, SCAM_TYPES, TYPE_LABEL } from "@/lib/mock";
import type { EntityStatus, EntityType, ScamType } from "@/lib/types";
import { useOps } from "../store";

export default function VerificationPage() {
  const { entities, log, decide } = useOps();
  const toast = useToast();
  const [tab, setTab] = useState<EntityStatus>("unverified");
  const [et, setEt] = useState<EntityType | "all">("all");
  const [st, setSt] = useState<ScamType | "all">("all");

  const rows = entities
    .filter((e) => e.status === tab && (et === "all" || e.type === et) && (st === "all" || e.scam_type === st))
    .sort((x, y) => y.confidence - x.confidence);
  const cnt = (s: EntityStatus) => entities.filter((e) => e.status === s).length;
  const pendingTab = tab === "unverified";

  return (
    <>
      <Top title="Verification" sub="Only verified entities return high confidence in the lookup API. Every decision is logged." />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "unverified", label: "Unverified", count: cnt("unverified") },
          { id: "verified", label: "Verified", count: cnt("verified") },
          { id: "rejected", label: "Rejected", count: cnt("rejected") },
        ]}
      />
      <div className="bar">
        <Select
          label="Entity type"
          value={et}
          onChange={setEt}
          options={[["all", "All types"], ...ENTITY_TYPES.map((k) => [k, TYPE_LABEL[k]] as [EntityType, string])]}
        />
        <Select
          label="Scam type"
          value={st}
          onChange={setSt}
          options={[["all", "All scam types"], ...SCAM_TYPES.map((k) => [k, SCAM_LABEL[k]] as [ScamType, string])]}
        />
        {pendingTab && rows.length ? (
          <Button
            variant="secondary"
            className="ml-auto"
            onClick={() => {
              rows.filter((r) => r.confidence >= 0.9).forEach((r) => decide("verified")(r.id));
              toast("Verified all ≥ 90%");
            }}
          >
            Verify all ≥ 90%
          </Button>
        ) : null}
      </div>
      {rows.length ? (
        <EntityTable
          rows={rows}
          onVerify={pendingTab ? decide("verified") : undefined}
          onReject={pendingTab ? decide("rejected") : undefined}
        />
      ) : (
        <Empty>{pendingTab ? "Queue clear. New entities land here as personas extract them." : "Nothing matches these filters."}</Empty>
      )}
      <div className="col">
        <div className="sec">
          <h2>Decision log</h2>
        </div>
        <div className="uk-card uk-card-bd">
          {log.length ? (
            <ul className="timeline">
              {log
                .slice()
                .reverse()
                .map((l, i) => (
                  <li key={i}>
                    <time>{l.at}</time>
                    <span>
                      Operator <b>{l.decision}</b> <code className="inl">{l.value}</code>
                    </span>
                  </li>
                ))}
            </ul>
          ) : (
            <span className="uk-muted">No decisions yet this session.</span>
          )}
        </div>
      </div>
    </>
  );
}
