"use client";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Badge, Chip, Head } from "@/components/ui";
import { BANKS, digits, fullVal, plural, showVal, typeLabel } from "@/lib/format";
import { useQuery } from "@/lib/hooks";
import { decide, queueOf, useStore } from "@/lib/store";
import type { Entity } from "@/lib/types";

const keysHint = (
  <span className="live">
    <span className="muted" style={{ fontSize: 15 }}>
      Keys:
    </span>
    <span className="mono" style={{ fontSize: 14 }}>
      V verify · R reject · J/K next
    </span>
  </span>
);
const SUB = "A human confirms every scam account before any bank sees it.";

export function VerifyView() {
  const { data } = useStore();
  const q = useQuery();
  const [note, setNote] = useState("");
  const queue = queueOf(data);
  const e = queue.find((x) => x.id === q.get("selected")) ?? queue[0];

  const act = (to: "verified" | "rejected") => {
    if (!e) return;
    decide(e.id, to, note);
    setNote("");
  };

  // Keyboard: V verify, R reject, J/K or arrows to move.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const t = ev.target as HTMLElement;
      if (/INPUT|TEXTAREA|SELECT/.test(t.tagName) || ev.metaKey || ev.ctrlKey || ev.altKey || !e) return;
      const i = Math.max(0, queue.findIndex((x) => x.id === e.id));
      const k = ev.key.toLowerCase();
      if (k === "v") act("verified");
      else if (k === "r") act("rejected");
      else if (k === "j" || k === "arrowdown") q.set({ selected: queue[Math.min(queue.length - 1, i + 1)].id });
      else if (k === "k" || k === "arrowup") q.set({ selected: queue[Math.max(0, i - 1)].id });
      else return;
      ev.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!e)
    return (
      <>
        <Head title="Verify queue" sub={SUB} right={keysHint} />
        <div className="card empty" style={{ padding: 48 }}>
          <b>Queue clear</b>
          <span>Nothing is waiting for a human. New accounts appear here the moment a scammer sends one.</span>
          <div className="row-gap">
            <Link className="btn btn-secondary" href="/entities">
              See all entities
            </Link>
            <Link className="btn btn-primary" href="/demo/bank">
              Test in bank simulator →
            </Link>
          </div>
        </div>
      </>
    );

  const c = e.convoId ? data.convos.find((x) => x.id === e.convoId) : undefined;
  const p = c && data.personas.find((x) => x.id === c.personaId);
  const src = c ? c.msgs.findIndex((m) => (m.who === "scammer" && digits(m.text).includes(digits(e.value))) || m.text.includes(e.value)) : -1;
  const lines = c && src > -1 ? c.msgs.slice(Math.max(0, src - 1), src + 1) : [];
  const late = (e.stageAt ?? 0) >= 2;
  const stageKnown = e.stageAt !== undefined;
  const checks: [boolean, string][] = [
    [true, "Sent by the scammer, not the persona"],
    stageKnown
      ? [late, late ? "Sent during the Payment request stage" : "Sent before the Payment request stage — check the context"]
      : [false, "Stage at capture not reported — check the excerpt"],
    [true, e.type === "bank_account" ? `Valid length for a ${BANKS[e.bank] ?? e.bank} account number` : e.type === "wallet" ? "Valid TRON address format" : "Valid format"],
    [e.sightings > 1, e.sightings > 1 ? `Seen in ${e.sightings} conversations` : "Seen in only 1 conversation so far — check the excerpt"],
  ];

  return (
    <>
      <Head title="Verify queue" sub={SUB} right={keysHint} />
      <div className="split-v">
        <div className="list">
          <span className="caps muted">{queue.length} pending</span>
          {queue.map((x) => (
            <button key={x.id} className="item" onClick={() => q.set({ selected: x.id })} aria-current={x.id === e.id} data-testid="entity-row">
              <span className="top">
                <span className="caps muted" style={{ flex: 1 }}>
                  {typeLabel(x)}
                </span>
                <span className="muted" style={{ fontSize: 15 }}>
                  {x.first}
                </span>
              </span>
              <span className="mono" data-testid="entity-value" style={{ overflow: "hidden", textOverflow: "ellipsis" }}>
                {showVal(x)}
              </span>
              <span className="row-gap">
                <Chip>{x.scam}</Chip>
                <span data-testid="entity-confidence">
                  <Badge word={x.conf} />
                </span>
                <span className="muted" style={{ fontSize: 15 }}>
                  {plural(x.sightings, "sighting")}
                </span>
                {x.sample && <Badge word="sample" />}
              </span>
            </button>
          ))}
        </div>
        <section className="card evi" aria-label="Evidence">
          <div className="row-gap" style={{ justifyContent: "space-between" }}>
            <div>
              <span className="caps muted">
                {typeLabel(e)}
                {e.bank && BANKS[e.bank] ? ` (${BANKS[e.bank]})` : ""}
              </span>
              <div className="big" style={{ overflowWrap: "anywhere" }}>
                {fullVal(e)}
              </div>
            </div>
            <div className="row-gap">
              <Chip>{e.scam}</Chip>
              <Badge word="unverified" />
              <Badge word={e.conf} />
            </div>
          </div>
          <div className="facts">
            <div>
              <span className="caps muted">Sightings</span>
              <b>{plural(e.sightings, "conversation")}</b>
            </div>
            <div>
              <span className="caps muted">First seen</span>
              <b>{e.first}</b>
            </div>
            <div>
              <span className="caps muted">Source</span>
              <b>{c && p ? `${c.scammer} → ${p.name}` : e.sample ? "Seed data" : "Chat not found"}</b>
            </div>
            <div>
              <span className="caps muted">Channel</span>
              <b>{c ? (c.web ? "Web chat" : "Telegram") : "—"}</b>
            </div>
          </div>
          <div className="why">
            <span className="caps muted">Why the system flagged this</span>
            <ul>
              {checks.map(([ok, t]) => (
                <li key={t}>
                  <span className={`tick ${ok ? "y" : "n"}`}>{ok ? "✓" : "!"}</span>
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="excerpt">
            {lines.length && c ? (
              <>
                <div className="row-gap" style={{ justifyContent: "space-between" }}>
                  <span className="caps muted">Source excerpt</span>
                  <Link className="btn btn-quiet btn-sm" href={`/conversations/${c.id}`}>
                    Open full chat →
                  </Link>
                </div>
                {lines.map((m, i) => (
                  <div key={i} className="line">
                    <span className={`caps ${m.who === "scammer" ? "" : "muted"}`}>{m.who}</span>
                    <span>{highlight(m.text, e)}</span>
                  </div>
                ))}
              </>
            ) : (
              <>
                <span className="caps muted">Source excerpt</span>
                <span className="muted">{e.sample ? "Sample entity, no chat attached." : "No source message found for this entity."}</span>
              </>
            )}
          </div>
          <div className="field">
            <label htmlFor="note">Note (optional)</label>
            <input className="input" id="note" placeholder='e.g. "matches job-scam script #2"' value={note} onChange={(ev) => setNote(ev.target.value)} />
          </div>
          <div className="acts-row">
            <p>After you verify: confidence becomes high, and bank lookups return a match straight away.</p>
            <button className="btn btn-secondary" onClick={() => act("rejected")} data-testid="reject-btn">
              Reject <span className="kbd">R</span>
            </button>
            <button className="btn btn-success" onClick={() => act("verified")} data-testid="verify-btn">
              Verify <span className="kbd">V</span>
            </button>
          </div>
        </section>
      </div>
    </>
  );
}

// Mark the captured value inside the source message.
function highlight(text: string, e: Entity): ReactNode {
  let hit = e.type === "bank_account" ? null : text.includes(e.value) ? e.value : null;
  if (!hit) {
    const m = text.match(/(\d[\d\s-]{8,}\d)/);
    if (m && digits(m[1]) === digits(e.value)) hit = m[1];
  }
  if (!hit) return text;
  const i = text.indexOf(hit);
  return (
    <>
      {text.slice(0, i)}
      <mark>{hit}</mark>
      {text.slice(i + hit.length)}
    </>
  );
}
