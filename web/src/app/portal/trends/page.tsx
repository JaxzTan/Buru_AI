import { BarChart, HBars } from "@/components/app/charts";
import { Top } from "@/components/app/primitives";
import { ENTITIES, SCAM_LABEL, TYPE_LABEL, WEEKS } from "@/lib/mock";
import type { EntityType, ScamType } from "@/lib/types";

function tally<K extends string>(key: (e: (typeof ENTITIES)[number]) => K, weight: number) {
  const by = {} as Record<K, number>;
  for (const e of ENTITIES) by[key(e)] = (by[key(e)] || 0) + e.sightings * weight;
  return (Object.keys(by) as K[]).sort((a, b) => by[b] - by[a]).map((k) => ({ k, v: by[k] }));
}

export default function TrendsPage() {
  const byScam = tally<ScamType>((e) => e.scam_type, 37);
  const byType = tally<EntityType>((e) => e.type, 21);

  return (
    <>
      <Top title="Trends" sub="What the honeypot network is seeing across Malaysia." />
      <div className="uk-card">
        <div className="uk-card-hd">
          <h3>Verified entities per week</h3>
          <span className="uk-muted text-xs">+124% since early September</span>
        </div>
        <div className="uk-card-bd">
          <BarChart data={WEEKS} label="Verified entities per week" unit="entities" />
        </div>
      </div>
      <div className="split">
        <div className="uk-card">
          <div className="uk-card-hd">
            <h3>By scam type</h3>
            <span className="uk-muted text-xs">last 30 days</span>
          </div>
          <div className="uk-card-bd">
            <HBars rows={byScam.map((r) => ({ ...r, label: SCAM_LABEL[r.k] }))} />
          </div>
        </div>
        <div className="uk-card">
          <div className="uk-card-hd">
            <h3>By entity type</h3>
            <span className="uk-muted text-xs">last 30 days</span>
          </div>
          <div className="uk-card-bd">
            <HBars rows={byType.map((r) => ({ ...r, label: TYPE_LABEL[r.k] }))} />
          </div>
        </div>
      </div>
      <div className="uk-card">
        <div className="uk-card-hd">
          <h3>Notable this week</h3>
        </div>
        <div className="uk-card-bd">
          <ul className="timeline">
            <li>
              <time>20–22 Oct</time>
              <span>Job scams shifted from WhatsApp to Telegram “Shopee reviewer” groups; 41 new mule accounts, mostly MBB and CIMB.</span>
            </li>
            <li>
              <time>18 Oct</time>
              <span>
                New fake BNM verification domain pattern <code className="inl">*-semakan.*</code> used in Macau-scam calls.
              </span>
            </li>
            <li>
              <time>15 Oct</time>
              <span>USDT investment scams consolidating into 3 TRON wallets that cash out at one exchange deposit address.</span>
            </li>
          </ul>
        </div>
      </div>
    </>
  );
}
