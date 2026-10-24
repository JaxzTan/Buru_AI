import type { ScamType } from "@/lib/types";

const SCAM: Record<ScamType, [code: string, label: string]> = {
  parcel: ["PCL", "Parcel"],
  job: ["JOB", "Job"],
  investment: ["INV", "Investment"],
  impersonation: ["IMP", "Impersonation"],
  romance: ["ROM", "Romance"],
  other: ["OTH", "Other"],
};

export function ScamTypeTag({ type }: { type: ScamType }) {
  const [code, label] = SCAM[type] ?? SCAM.other;
  return (
    <span className="uk-tag">
      <b>{code}</b>
      {label}
    </span>
  );
}
