"use client";
import type { ReactNode } from "react";
import { Badge, Head, type Tone } from "@/components/ui";
import { DEV_CHAT, useAgo } from "@/lib/hooks";
import { activePersonas, liveConvos, toast, toggleTelegram, useStore } from "@/lib/store";

function Tile({ id, label, big, sub, word, tone, bad }: { id: string; label: string; big: ReactNode; sub: string; word: string; tone: Tone; bad?: boolean }) {
  return (
    <div className={`card tile${bad ? " bad" : ""}`} data-testid={id}>
      <div className="th">
        <span className="caps">{label}</span>
        <Badge word={word} tone={tone} />
      </div>
      <div className="v">{big}</div>
      <small>{sub}</small>
    </div>
  );
}

export function StatusView() {
  const { data } = useStore();
  const ago = useAgo();
  const ok = data.telegram;
  return (
    <>
      <Head
        title="Status"
        sub="Proof the honeypot listens 24/7, and that we know within 2 minutes if it stops."
        right={
          <button className="btn btn-secondary" onClick={() => toast("This will open status.sockabus.my (Uptime Kuma) once it is deployed")}>
            Open uptime monitor ↗
          </button>
        }
      />
      <div className={`overall ${ok ? "ok" : "bad"}`} role="status">
        <span className="ic">{ok ? "✓" : "!"}</span>
        <div className="txt">
          <h2>{ok ? "All systems operational" : "Degraded: Telegram disconnected"}</h2>
          <span className="muted" style={{ fontSize: 15 }}>
            {ok ? `Auto-refresh every 10 s · last checked ${ago}` : "Team alerted by Telegram group and email. Demo can continue on Web chat."}
          </span>
        </div>
        {/* Prototype control: remove in production (spec S6). */}
        {DEV_CHAT && (
          <button className="btn btn-secondary btn-sm" onClick={toggleTelegram}>
            {ok ? "Simulate: Telegram drops" : "Simulate: reconnect"}
          </button>
        )}
      </div>
      <div className="tiles">
        <Tile
          id="status-telegram"
          label="Telegram honeypot"
          big={ok ? "Connected" : "Disconnected"}
          sub={ok ? `${activePersonas(data).length} accounts active · heartbeat every 60 s` : "No heartbeat for 2 min · alert sent"}
          word={ok ? "up" : "down"}
          tone={ok ? "success" : "danger"}
          bad={!ok}
        />
        <Tile
          id="status-last-message"
          label="Last message received"
          big={ok ? ago : "2 min ago"}
          sub={ok ? "From the most recent scammer chat" : "Nothing received since the drop"}
          word={ok ? "live" : "stale"}
          tone={ok ? "success" : "warning"}
        />
        <Tile id="status-llm-errors" label="AI model" big="0 errors" sub="Gemini · last 15 minutes · fallback: Claude" word="ok" tone="success" />
        <Tile id="status-workflows" label="Conversations running" big={String(liveConvos(data).length)} sub="Capacity 1,000 · none stuck over 2 h" word="running" tone="info" />
        <Tile id="status-api" label="Lookup API" big="41 ms" sub="Synthetic check every 60 s returns a match as expected" word="up" tone="success" />
        <Tile id="status-health" label="Backend health" big="200 OK" sub="Database, Redis and Temporal reachable" word="up" tone="success" />
      </div>
      <div className="lower">
        <div className="card uptime">
          <div className="row-gap" style={{ justifyContent: "space-between" }}>
            <span className="caps muted">Last 24 hours</span>
            <b style={{ color: "var(--green)" }}>99.9% up</b>
          </div>
          <div className="bars" aria-label="Hourly uptime, last 24 hours">
            {Array.from({ length: 24 }, (_, i) => (
              <i key={i} className={i === 9 ? "a" : i === 23 && !ok ? "r" : ""} title={`${i}:00`} />
            ))}
          </div>
          <span className="muted" style={{ fontSize: 15 }}>
            One amber hour at 09:00: the bot restarted after a deploy and reconnected in 40 s. Amber means degraded, red means down.
          </span>
        </div>
        <div className="alerting">
          <span className="caps">If something stops</span>
          <h3>The team gets a Telegram and email alert within 2 minutes.</h3>
          <p>Last drill: bot stopped on purpose at 15:10, alert arrived in 1 min 38 s, recovery alert on restart.</p>
        </div>
      </div>
    </>
  );
}
