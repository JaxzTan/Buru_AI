import Link from "next/link";
import type { ReactNode } from "react";
import { plural } from "@/lib/format";
import type { Entity, ScamType } from "@/lib/types";

// Bank accounts by scam type: one series, ink bars ≤ 20 px with a 4 px rounded tip, value at the tip,
// hover/focus tooltip. Each bar links to the matching Entities list.
export function ScamBars({ accounts }: { accounts: Entity[] }) {
  const by = new Map<ScamType, { n: number; verified: number }>();
  for (const e of accounts) {
    const r = by.get(e.scam) ?? { n: 0, verified: 0 };
    r.n++;
    if (e.status === "verified") r.verified++;
    by.set(e.scam, r);
  }
  const rows = [...by.entries()].sort((a, b) => b[1].n - a[1].n || a[0].localeCompare(b[0]));
  if (!rows.length)
    return (
      <Empty title="No bank accounts captured yet">
        <span>Accounts appear here when a scammer sends one in a chat.</span>
      </Empty>
    );
  const max = rows[0][1].n;
  return (
    <ul className="hbars" aria-label="Bank accounts captured, by scam type">
      {rows.map(([scam, r]) => {
        const text = `${scam}: ${plural(r.n, "account")}, ${r.verified} verified`;
        return (
          <li key={scam}>
            <Link href={`/entities?type=bank_account&q=${scam}`} aria-label={text} data-testid="overview-scam-bar">
              <span className="lbl">{scam}</span>
              <span className="track">
                <span className="bar" style={{ width: `${(r.n / max) * 100}%` }} />
                <span className="val">{r.n}</span>
              </span>
              <span className="tip" aria-hidden="true">
                {plural(r.n, "account")} · {r.verified} verified
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="empty" style={{ padding: "20px 12px" }}>
      <b>{title}</b>
      {children}
    </div>
  );
}
