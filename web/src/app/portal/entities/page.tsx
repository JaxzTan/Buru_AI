"use client";

import { useState } from "react";
import { Empty, Select, Top } from "@/components/app/primitives";
import { useToast } from "@/components/app/Toast";
import { Button, EntityTable } from "@/components/ui";
import { ENTITIES, ENTITY_TYPES, MY_BANK, SCAM_LABEL, SCAM_TYPES, TYPE_LABEL } from "@/lib/mock";
import type { EntityType, ScamType } from "@/lib/types";
import { downloadCsv } from "@/lib/utils";

export default function PortalEntitiesPage() {
  const toast = useToast();
  const [et, setEt] = useState<EntityType | "all">("all");
  const [st, setSt] = useState<ScamType | "all">("all");
  const [mine, setMine] = useState(false);

  const rows = ENTITIES.filter(
    (e) => e.status === "verified" && (et === "all" || e.type === et) && (st === "all" || e.scam_type === st) && (!mine || e.bank === MY_BANK),
  );

  function exportCsv() {
    const name = "unknown-entities.csv";
    const ok = downloadCsv(
      rows.map((r) => ({ type: r.type, value: r.value, bank_or_chain: r.bank || "", scam_type: r.scam_type, sightings: r.sightings, last_seen: r.last_seen })),
      name,
    );
    toast(ok ? `Exported ${rows.length} rows to ${name}` : "Export blocked in this preview");
  }

  return (
    <>
      <Top
        title="Entities"
        sub="Verified scam entities. Update your internal rules from here or pull them through the API."
        actions={
          <Button variant="secondary" onClick={exportCsv}>
            Export CSV
          </Button>
        }
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
        <label className="chk">
          <input type="checkbox" checked={mine} onChange={() => setMine(!mine)} />
          Only accounts at my bank ({MY_BANK})
        </label>
        <span className="uk-muted ml-auto text-xs">{rows.length} results</span>
      </div>
      {rows.length ? <EntityTable rows={rows} /> : <Empty>No verified entities match these filters.</Empty>}
    </>
  );
}
