import type { Status } from "@/lib/types";
import { cx } from "@/lib/utils";

const STATUS: Record<Status, [tone: string, label: string]> = {
  unverified: ["signal", "Unverified"],
  verified: ["verified", "Verified"],
  rejected: ["neutral", "Rejected"],
  bot: ["live", "Bot replying"],
  human: ["signal", "Operator"],
  closed: ["neutral", "Closed"],
  active: ["live", "Active"],
  banned: ["scam", "Banned"],
  cooldown: ["signal", "Cooldown"],
  match: ["scam", "Match"],
  clear: ["verified", "No match"],
  revoked: ["neutral", "Revoked"],
};

export interface StatusBadgeProps {
  status: Status;
  label?: string;
}

/** Every state is a word — colour only reinforces. */
export function StatusBadge({ status, label }: StatusBadgeProps) {
  const [tone, text] = STATUS[status] ?? ["neutral", status];
  const live = status === "bot" || status === "active";
  return (
    <span className={cx("uk-badge", "uk-badge-" + tone, status === "rejected" && "uk-badge-strike")}>
      {live ? <span className="uk-dot uk-dot-pulse" aria-hidden /> : null}
      {label || text}
    </span>
  );
}
