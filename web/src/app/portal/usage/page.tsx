"use client";

import { BarChart, HBars } from "@/components/app/charts";
import { Top } from "@/components/app/primitives";
import { StatTile } from "@/components/ui";
import { DAYS } from "@/lib/mock";
import { usePortal } from "../store";

const kfmt = (v: number) => (v >= 1000 ? (v / 1000).toFixed(v % 1000 ? 1 : 0) + "k" : v);

export default function UsagePage() {
  const { lookups: total } = usePortal();
  return (
    <>
      <Top title="Usage" sub="October 2026 · Pilot plan, 100,000 lookups / month." />
      <div className="stats">
        <StatTile label="Lookups (Oct)" value={total.toLocaleString("en-US")} detail="of 100,000" progress={total / 1000} />
        <StatTile label="Projected month" value={Math.round((total / 22) * 31).toLocaleString("en-US")} detail="at current pace" />
        <StatTile label="Match rate" value="0.65%" detail="312 matches" />
        <StatTile label="Errors" value="0.02%" detail="availability 99.98%" />
      </div>
      <div className="uk-card">
        <div className="uk-card-hd">
          <h3>Lookups per day</h3>
          <span className="uk-muted text-xs">1–22 Oct</span>
        </div>
        <div className="uk-card-bd">
          <BarChart data={DAYS} label="Lookups per day in October" unit="lookups" fmt={kfmt} />
        </div>
      </div>
      <div className="uk-card">
        <div className="uk-card-hd">
          <h3>By key</h3>
        </div>
        <div className="uk-card-bd">
          <HBars
            rows={[
              { k: "Production — payments", v: Math.round(total * 0.91) },
              { k: "Fraud analyst scripts", v: Math.round(total * 0.08) },
              { k: "Portal (manual)", v: Math.round(total * 0.01) },
            ]}
          />
        </div>
      </div>
    </>
  );
}
