"use client";

import { useState, type FormEvent } from "react";
import { Empty, Tabs, Top } from "@/components/app/primitives";
import { useToast } from "@/components/app/Toast";
import { Button, ConversationThread, EntityValue, ScamTypeTag, StatusBadge } from "@/components/ui";
import { SCAM_LABEL } from "@/lib/mock";
import type { Conversation } from "@/lib/types";
import { personaName, useOps } from "../store";

type Filter = "all" | "human" | "stuck" | "closed";

const matches = (c: Conversation, f: Filter) =>
  f === "all" ? c.status !== "closed" : f === "stuck" ? !!c.stuck : c.status === f;

export default function LiveChatsPage() {
  const { convos, entities, personas, toggle, send, close } = useOps();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>("all");
  const [sel, setSel] = useState(convos[0].id);
  const [draft, setDraft] = useState("");

  const list = convos.filter((c) => matches(c, filter));
  const c = convos.find((x) => x.id === sel) ?? list[0];
  const ents = c ? entities.filter((e) => e.convo === c.id) : [];
  const persona = c ? personas.find((x) => x.id === c.persona) : undefined;
  const count = (f: Filter) => convos.filter((x) => matches(x, f)).length;

  function onSend(e: FormEvent) {
    e.preventDefault();
    if (!c || !draft.trim()) return;
    send(c.id, draft.trim());
    setDraft("");
  }

  return (
    <>
      <Top title="Live chats" sub="Every honeypot conversation, routed to its persona. Take over any chat in one click." />
      <div className="chat">
        <div className="chat-list">
          <Tabs
            value={filter}
            onChange={setFilter}
            tabs={[
              { id: "all", label: "Open", count: count("all") },
              { id: "human", label: "Operator", count: count("human") },
              { id: "stuck", label: "Stuck", count: count("stuck") },
              { id: "closed", label: "Closed", count: count("closed") },
            ]}
          />
          <ul>
            {list.map((x) => {
              const last = x.msgs.filter((m) => m.dir !== "system").slice(-1)[0];
              return (
                <li key={x.id}>
                  <button type="button" className={"chat-item" + (c && x.id === c.id ? " on" : "")} onClick={() => setSel(x.id)}>
                    <span className="r1">
                      <span className="h">{x.scammer}</span>
                      <span className="t">{x.time}</span>
                    </span>
                    <span className="p">{(last.dir === "in" ? "" : "You: ") + last.text}</span>
                    <span className="r1">
                      <ScamTypeTag type={x.scam} />
                      <StatusBadge status={x.status} />
                    </span>
                  </button>
                </li>
              );
            })}
            {list.length ? null : <li className="empty m-4">No chats here.</li>}
          </ul>
        </div>
        {c ? (
          <div className="chat-mid">
            <ConversationThread
              title={c.scammer + " → " + personaName(personas, c.persona)}
              status={c.status}
              stage={c.stage}
              messages={c.msgs}
              onTakeover={c.status === "closed" ? undefined : () => toggle(c.id)}
            />
            {c.status === "human" ? (
              <form className="composer" onSubmit={onSend}>
                <input
                  className="uk-input"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder={"Reply as " + personaName(personas, c.persona) + "…"}
                  aria-label="Message"
                />
                <Button variant="primary" type="submit">
                  Send
                </Button>
              </form>
            ) : null}
          </div>
        ) : (
          <Empty>Select a chat</Empty>
        )}
        {c && persona ? (
          <div className="chat-side">
            <div>
              <div className="uk-over mb-2">Persona</div>
              <div className="font-semibold">
                {persona.name}, {persona.age}
              </div>
              <div className="uk-muted text-xs">{persona.backstory}</div>
            </div>
            <dl className="kv">
              <dt>Channel</dt>
              <dd>{c.channel === "TG" ? "Telegram" : "WhatsApp"}</dd>
              <dt>Scam type</dt>
              <dd>{SCAM_LABEL[c.scam]}</dd>
              <dt>Stage</dt>
              <dd>{c.stage}</dd>
              <dt>Messages</dt>
              <dd className="uk-mono">{c.msgs.filter((m) => m.dir !== "system").length}</dd>
            </dl>
            <div>
              <div className="uk-over mb-2">Extracted ({ents.length})</div>
              {ents.length ? (
                <div className="flex flex-col gap-2">
                  {ents.map((e) => (
                    <div key={e.id} className="flex flex-col gap-1">
                      <EntityValue type={e.type} value={e.value} bank={e.bank} display={e.display} />
                      <span className="bar">
                        <StatusBadge status={e.status} />
                        <span className="uk-mono uk-muted text-xs">{Math.round(e.confidence * 100)}%</span>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="uk-muted text-xs">Nothing yet — playbook is steering toward payment details.</div>
              )}
            </div>
            {c.status !== "closed" ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  close(c.id);
                  toast("Conversation closed");
                }}
              >
                Close conversation
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}
