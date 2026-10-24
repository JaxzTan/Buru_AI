import type { EntityType, LookupResultData } from "@/lib/types";
import { cx, fmtDate } from "@/lib/utils";
import { EntityValue } from "./EntityValue";
import { ScamTypeTag } from "./ScamTypeTag";
import { StatusBadge } from "./StatusBadge";

export interface LookupResultProps {
  result: LookupResultData;
  query?: { type: EntityType; value: string; bank?: string };
  latency?: number;
}

/** Verdict first, evidence second. */
export function LookupResult({ result, query, latency }: LookupResultProps) {
  const m = result.match;
  return (
    <section className={cx("uk-lr", m ? "uk-lr-match" : "uk-lr-clear")} aria-live="polite">
      <div className="uk-lr-hd">
        <span className="uk-lr-verdict">{m ? "● Match — hold transfer" : "○ No match"}</span>
        {query ? <EntityValue type={query.type} value={query.value} bank={query.bank} copyable={false} /> : null}
        {latency != null ? <span className="uk-mono ml-auto text-xs text-ink-muted">{latency} ms</span> : null}
      </div>
      {m ? (
        <dl className="uk-lr-bd">
          <div>
            <dt>Confidence</dt>
            <dd>
              <StatusBadge status={result.confidence === "high" ? "verified" : "unverified"} label={result.confidence} />
            </dd>
          </div>
          <div>
            <dt>Scam types</dt>
            <dd>{(result.scam_types ?? []).map((t) => <ScamTypeTag key={t} type={t} />)}</dd>
          </div>
          <div>
            <dt>First seen</dt>
            <dd>{fmtDate(result.first_seen)}</dd>
          </div>
          <div>
            <dt>Last seen</dt>
            <dd>{fmtDate(result.last_seen)}</dd>
          </div>
          <div>
            <dt>Sightings</dt>
            <dd>{String(result.sightings ?? 0)}</dd>
          </div>
        </dl>
      ) : null}
    </section>
  );
}
