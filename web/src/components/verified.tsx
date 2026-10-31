"use client";
import Link from "next/link";
import { showVal, typeLabel } from "@/lib/format";
import { clearJustVerified, useStore } from "@/lib/store";

// After Verify on a bank account (Verify page, chat card, Dashboard): one click to test it on the bank.
// Only the entity id goes in the URL, never the account number (spec §4.2).
export const bankHref = (id: string) => `/demo/bank?entity=${encodeURIComponent(id)}`;

export function JustVerified() {
  const { data, ui } = useStore();
  const e = ui.justVerified ? data.entities.find((x) => x.id === ui.justVerified && x.status === "verified") : undefined;
  if (!e) return null;
  return (
    <div className="banner ok-banner" role="status" data-testid="just-verified">
      <div className="txt">
        <h3>
          Verified {typeLabel(e)} <span className="mono">{showVal(e)}</span>
        </h3>
        <p>Banks checking this account now get a match with high confidence.</p>
      </div>
      <div className="acts">
        <button type="button" className="btn btn-quiet btn-sm" onClick={clearJustVerified}>
          Dismiss
        </button>
        <Link className="btn btn-secondary" href={bankHref(e.id)} data-testid="bank-test-link">
          Test in bank simulator →
        </Link>
      </div>
    </div>
  );
}
