"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { Avatar, Badge, Chip, Head, Typing } from "@/components/ui";
import { showVal } from "@/lib/format";
import { DEV_CHAT, useQuery, useStickToBottom } from "@/lib/hooks";
import { SCRIPT } from "@/lib/seed";
import { activePersonas, markScript, scammerSends, useStore, type State } from "@/lib/store";
import type { Conversation, Persona } from "@/lib/types";

const helper = (
  <aside className="helper">
    <span className="caps">When to use this page</span>
    <h3>Telegram down on demo day? Open this on a second laptop. Everything else stays the same.</h3>
    <ul>
      <li>Tap a script line to fill the box, so nobody types on stage.</li>
      <li>Watch the reply appear on Conversations. The real persona waits 10–30 s; the demo waits about 2 s.</li>
      <li>The account you send shows up in the Verify queue.</li>
    </ul>
  </aside>
);
const SUB = "You play the scammer. Same pipeline as Telegram. Used as the demo fallback and by automated tests.";

export function WebChatView() {
  const { data, ui } = useStore();
  const q = useQuery();
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const act = activePersonas(data);
  const p = act.find((x) => x.id === q.get("persona")) ?? act[0];
  const c = p && data.convos.find((x) => x.personaId === p.id && x.web);
  const typing = !!c && ui.typing[c.id];
  const ref = useStickToBottom(`${c?.msgs.length}-${typing}`);

  if (!DEV_CHAT)
    return (
      <>
        <Head title="Web chat" sub={SUB} />
        <div className="card empty" style={{ padding: 48 }}>
          <b>Web chat is turned off</b>
          <span>Set NEXT_PUBLIC_DEV_CHAT=true to use it.</span>
        </div>
      </>
    );

  const badge = <Badge word="Dev only · NEXT_PUBLIC_DEV_CHAT" tone="warning" />;
  if (!p)
    return (
      <>
        <Head title="Web chat" sub={SUB} right={badge} />
        <div className="wc">
          <div className="card empty" style={{ padding: 48 }}>
            <b>No active personas</b>
            <span>Scammers can only reach active personas. Activate one first.</span>
            <Link className="btn btn-primary" href="/personas">
              Go to Personas →
            </Link>
          </div>
          {helper}
        </div>
      </>
    );

  return (
    <>
      <Head title="Web chat" sub={SUB} right={badge} />
      <div className="wc">
        <section className="card phone" aria-label="Scammer chat">
          <div className="phone-h">
            <Avatar p={p} lg />
            <div className="who wc-who">
              <label className="caps" htmlFor="wc-persona" style={{ color: "var(--faint)" }}>
                Talking to
              </label>
              <select id="wc-persona" value={p.id} onChange={(ev) => q.set({ persona: ev.target.value })} data-testid="webchat-persona-select">
                {act.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.name} (active)
                  </option>
                ))}
              </select>
            </div>
            <Badge word="active" />
          </div>
          <div className="msgs" ref={ref}>
            {c ? (
              c.msgs.map((m, i) => (
                <div key={i} className={`msg ${m.who === "scammer" ? "mine" : "them"}`} data-testid="webchat-message">
                  <p>{m.text}</p>
                  <small>{m.who === "scammer" ? `You (scammer) · ${m.t} · delivered` : `${p.name} · ${m.t}`}</small>
                </div>
              ))
            ) : (
              <div className="empty">
                <b>Start the scam</b>
                <span>Tap &quot;Opener&quot; below, or type your own first message.</span>
              </div>
            )}
            {c?.status === "operator" && (
              <div className="msg them">
                <small>An operator has taken over this chat. Replies come from a human.</small>
              </div>
            )}
            {typing && <Typing name={p.name} />}
          </div>
          <div className="script">
            <span className="caps muted">Golden script · job scam</span>
            {SCRIPT.map(([label, text], i) => {
              const used = data.usedScript.includes(i);
              return (
                <button
                  key={label}
                  type="button"
                  className={used ? "used" : ""}
                  onClick={() => {
                    setDraft(text);
                    markScript(i);
                    inputRef.current?.focus();
                  }}
                >
                  {used ? "✓ " : ""}
                  {i + 1} {label}
                </button>
              );
            })}
          </div>
          <form
            onSubmit={(ev) => {
              ev.preventDefault();
              const t = draft.trim();
              if (!t) return;
              setDraft("");
              scammerSends(p.id, t);
              inputRef.current?.focus();
            }}
          >
            <input
              ref={inputRef}
              className="input"
              autoComplete="off"
              placeholder="Type as the scammer…"
              value={draft}
              onChange={(ev) => setDraft(ev.target.value)}
              data-testid="webchat-input"
              aria-label="Scammer message"
            />
            <button className="btn btn-primary" data-testid="webchat-send-btn">
              Send
            </button>
          </form>
        </section>
        <div className="wc-side">
          <TalkingTo st={{ data, ui }} p={p} c={c} />
          {helper}
        </div>
      </div>
    </>
  );
}

// "You are talking to": the persona the scammer is chatting with, and what this chat has captured.
// Every tile comes from the persona and chat data; a tile with no data is not shown.
function TalkingTo({ st, p, c }: { st: State; p: Persona; c: Conversation | null | undefined }) {
  const { data } = st;
  const live = data.convos.filter((x) => x.personaId === p.id && x.status !== "closed").length;
  const bait = p.detail?.profile?.bait;
  const playbooks = p.detail?.scamTypes ?? [];
  const tiles: [string, string, boolean?][] = [
    ["Honeypot", p.handle, true],
    ...(typeof bait === "string" && bait.trim() ? [["Bait", bait] as [string, string]] : []),
    ...(playbooks.length ? [["Playbooks", playbooks.map((x, i) => (i ? x : x[0].toUpperCase() + x.slice(1))).join(", ")] as [string, string]] : []),
    ["Live chats", String(live)],
  ];
  const captured = c ? data.entities.filter((e) => e.convoId === c.id) : [];
  return (
    <aside className="card wc-card" aria-label="You are talking to" data-testid="webchat-persona-card">
      <div className="th">
        <span className="caps muted">You are talking to</span>
        <Badge word={p.status} />
      </div>
      <div className="namecell">
        <Avatar p={p} lg />
        <div>
          <b>
            {p.name}
            {p.age ? `, ${p.age}` : ""}
          </b>
          <small>{[p.loc !== "—" ? p.loc : null, p.occ || null].filter(Boolean).join(" · ")}</small>
        </div>
      </div>
      {p.backstory && <p className="wc-story">{p.backstory}</p>}
      <div className="wc-tiles">
        {tiles.map(([k, v, mono]) => (
          <div key={k}>
            <span className="caps muted">{k}</span>
            <b className={mono ? "mono" : undefined}>{v}</b>
          </div>
        ))}
      </div>
      {p.langs.length > 0 && (
        <div className="wc-sec">
          <span className="caps muted">Speaks</span>
          <div className="row-gap">
            {p.langs.map((l) => (
              <Chip key={l}>{l}</Chip>
            ))}
          </div>
        </div>
      )}
      <div className="wc-sec">
        <span className="caps muted">Captured from your messages</span>
        {captured.length ? (
          captured.map((e) => (
            <div key={e.id} className="wc-cap" data-testid="webchat-captured">
              <span className="mono">
                {showVal(e)}
                {e.bank ? ` · ${e.bank}` : ""}
              </span>
              <span className="row-gap">
                <Badge word={e.status} />
                <Badge word={e.conf} />
              </span>
            </div>
          ))
        ) : (
          <span className="muted" style={{ fontSize: 15 }}>
            Nothing yet. Send an account number and it shows here.
          </span>
        )}
      </div>
      {c && (
        <Link className="btn btn-quiet btn-sm" href={`/conversations/${c.id}`} style={{ justifySelf: "start", paddingInline: 0 }}>
          See this chat in Conversations →
        </Link>
      )}
    </aside>
  );
}
