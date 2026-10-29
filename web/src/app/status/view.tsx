"use client";
import type { ReactNode } from "react";
import { Badge, Head, type Tone } from "@/components/ui";
import { DEV_CHAT, useAgo } from "@/lib/hooks";
import { isSimAccount } from "@/lib/api";
import { activePersonas, liveConvos, toast, toggleTelegram, USE_SAMPLE, useStore, type State } from "@/lib/store";

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
  const st = useStore();
  const ago = useAgo();
  if (!USE_SAMPLE) return <LiveStatus st={st} ago={ago} />;
  const { data } = st;
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

// API mode: tiles from GET /readyz, /internal/accounts and /internal/conversations.
// The backend has no /internal/status yet, so LLM errors, lookup latency and uptime history are not reported.
function LiveStatus({ st, ago }: { st: State; ago: string }) {
  const { data, ui } = st;
  const h = ui.health;
  const tg = ui.accounts.filter((a) => a.channel === "telegram" && !isSimAccount(a));
  const tgActive = tg.filter((a) => a.status === "active").length;
  const lastAt = data.convos.map((c) => c.last).at(0);
  const healthy = !!h?.ok && !ui.loadError;
  const checks = h ? Object.entries(h.checks) : [];
  const failing = checks.filter(([, v]) => v !== "ok").map(([k]) => k);
  return (
    <>
      <Head title="Status" sub="Proof the honeypot listens 24/7, and that we know within 2 minutes if it stops." />
      <div className={`overall ${healthy ? "ok" : "bad"}`} role="status">
        <span className="ic">{healthy ? "✓" : "!"}</span>
        <div className="txt">
          <h2>{!h ? "Checking…" : healthy ? "All systems operational" : "Degraded: backend not ready"}</h2>
          <span className="muted" style={{ fontSize: 15 }}>
            Auto-refresh every 10 s · data updated {ago}
          </span>
        </div>
      </div>
      <div className="tiles">
        <Tile
          id="status-telegram"
          label="Telegram honeypot"
          big={tg.length ? `${tgActive} of ${tg.length} active` : "No accounts"}
          sub={tg.length ? "Account status from the database · live connection state not reported" : "Bind one with make tglogin. Web chat still works."}
          word={tgActive ? "up" : "none"}
          tone={tgActive ? "success" : "warning"}
          bad={!tgActive}
        />
        <Tile
          id="status-last-message"
          label="Last message received"
          big={lastAt ?? "None yet"}
          sub="From the most recent scammer chat"
          word={lastAt ? "live" : "idle"}
          tone={lastAt ? "success" : "neutral"}
        />
        <Tile id="status-llm-errors" label="AI model" big="Not reported" sub="Needs an error count from the backend (/internal/status)" word="n/a" tone="neutral" />
        <Tile id="status-workflows" label="Conversations running" big={String(liveConvos(data).length)} sub={`${activePersonas(data).length} personas active`} word="running" tone="info" />
        <Tile id="status-api" label="Lookup API" big="Not reported" sub="Try it on the Bank simulator, which shows the real time taken" word="n/a" tone="neutral" />
        <Tile
          id="status-health"
          label="Backend health"
          big={h ? (h.status ? `${h.status} ${h.ok ? "OK" : "not ready"}` : "Unreachable") : "…"}
          sub={h ? (failing.length ? `Failing: ${failing.join(", ")}` : `${checks.map(([k]) => k).join(", ") || "No checks"} reachable · ${h.ms} ms`) : "Checking /readyz"}
          word={h?.ok ? "up" : "down"}
          tone={h?.ok ? "success" : "danger"}
          bad={!!h && !h.ok}
        />
      </div>
      <div className="lower">
        <div className="card uptime">
          <span className="caps muted">Last 24 hours</span>
          <span className="muted" style={{ fontSize: 15 }}>
            Uptime history comes from the uptime monitor (Uptime Kuma), which is not connected yet.
          </span>
        </div>
        <div className="alerting">
          <span className="caps">If something stops</span>
          <h3>The team gets a Telegram and email alert within 2 minutes.</h3>
          <p>Alerting runs in the uptime monitor, outside this console.</p>
        </div>
      </div>
    </>
  );
}
