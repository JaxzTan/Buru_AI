import type { ReactNode } from "react";
import type { ConvoStatus, Message, Stage } from "@/lib/types";
import { cx } from "@/lib/utils";
import { Button } from "./Button";
import { StageTrack } from "./StageTrack";
import { StatusBadge } from "./StatusBadge";

/** Scammer text is untrusted: plain text only, extracted entities wrapped in <mark>, never linkified. */
function renderBody(text: string, ents?: string[]): ReactNode {
  if (!ents?.length) return text;
  let parts: ReactNode[] = [text];
  for (const e of ents) {
    const next: ReactNode[] = [];
    for (const pt of parts) {
      if (typeof pt !== "string") {
        next.push(pt);
        continue;
      }
      const ix = pt.indexOf(e);
      if (ix < 0) {
        next.push(pt);
        continue;
      }
      next.push(
        pt.slice(0, ix),
        <mark className="uk-hl" key={e + ix}>
          {e}
        </mark>,
        pt.slice(ix + e.length),
      );
    }
    parts = next;
  }
  return parts;
}

export interface ConversationThreadProps {
  title?: string;
  status?: ConvoStatus;
  stage?: Stage;
  messages: Message[];
  onTakeover?: () => void;
}

export function ConversationThread({ title, status, stage, messages, onTakeover }: ConversationThreadProps) {
  return (
    <div className="uk-card overflow-hidden">
      {title ? (
        <div className="uk-card-hd">
          <h3>{title}</h3>
          {status ? <StatusBadge status={status} /> : null}
        </div>
      ) : null}
      {stage ? (
        <div className="px-4 pt-3">
          <StageTrack stage={stage} />
        </div>
      ) : null}
      <div className="uk-thread" role="log">
        {messages.map((m, k) =>
          m.dir === "system" ? (
            <div key={k} className="uk-sys">
              {m.text}
            </div>
          ) : (
            <div key={k} className={cx("uk-msg", m.dir === "in" ? "uk-msg-in" : "uk-msg-out", m.human && "uk-msg-human")}>
              {renderBody(m.text, m.entities)}
              <span className="uk-msg-meta">
                {(m.dir === "in" ? "scammer" : m.human ? "operator" : "persona") + " · " + m.time}
              </span>
            </div>
          ),
        )}
      </div>
      {onTakeover ? (
        <div className="uk-takeover">
          <span className="uk-muted text-xs">
            {status === "human" ? "You are replying as the persona. Bot is paused." : "Bot replies with a 10–90 s human delay."}
          </span>
          <Button size="sm" variant={status === "human" ? "secondary" : "primary"} onClick={onTakeover}>
            {status === "human" ? "Hand back to bot" : "Take over"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
