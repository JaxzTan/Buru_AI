import type { CSSProperties, ReactNode } from "react";
import { initials } from "@/lib/format";
import type { Persona } from "@/lib/types";

export type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "operator";

// Single badge vocabulary (spec §4.1): word → tone.
const TONE: Record<string, Tone> = {
  active: "success", draft: "neutral", paused: "warning", retired: "neutral",
  bot: "info", operator: "operator", closed: "neutral",
  unverified: "warning", verified: "success", rejected: "danger",
  high: "success", medium: "warning", low: "neutral",
  live: "info", sample: "neutral",
};

export function Badge({ word, tone }: { word: string; tone?: Tone }) {
  return <span className={`badge t-${tone ?? TONE[word] ?? "neutral"}`}>{word}</span>;
}

export function Chip({ children }: { children: ReactNode }) {
  return <span className="chip">{children}</span>;
}

const AV: Record<Persona["av"], CSSProperties> = {
  mustard: { background: "var(--mustard)" },
  blue: { background: "var(--blue-soft)", color: "var(--blue)" },
  green: { background: "var(--green-soft)", color: "var(--green)" },
  neutral: {},
};

export function Avatar({ p, lg }: { p: Pick<Persona, "name" | "av">; lg?: boolean }) {
  return (
    <span className={`av${lg ? " lg" : ""}`} style={AV[p.av]} aria-hidden="true">
      {initials(p.name)}
    </span>
  );
}

export function Head({ title, sub, right }: { title: string; sub: ReactNode; right?: ReactNode }) {
  return (
    <div className="head">
      <div>
        <h1>{title}</h1>
        <p>{sub}</p>
      </div>
      {right}
    </div>
  );
}

export const Spin = () => <span className="spin" aria-hidden="true" />;

export function Loading() {
  return (
    <div className="card empty" style={{ padding: 48 }}>
      <Spin />
      <span>Loading…</span>
    </div>
  );
}

export function Typing({ name }: { name: string }) {
  return (
    <div className="typing">
      <span>
        <i />
        <i />
        <i />
      </span>
      {name} is typing…
    </div>
  );
}
