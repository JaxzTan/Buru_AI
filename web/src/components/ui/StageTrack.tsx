import type { Stage } from "@/lib/types";
import { cx } from "@/lib/utils";

const STAGES: Stage[] = ["rapport", "bait", "payment request", "stall"];

export function StageTrack({ stage }: { stage: Stage }) {
  const i = Math.max(0, STAGES.indexOf(stage));
  return (
    <ol className="uk-stages" aria-label="Playbook stage">
      {STAGES.map((s, k) => (
        <li key={s} className={cx("uk-stage", k < i && "done", k === i && "now")} aria-current={k === i ? "step" : undefined}>
          {s}
        </li>
      ))}
    </ol>
  );
}
