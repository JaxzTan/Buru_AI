import type { AccountStatus, Channel } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";

export interface PersonaCardProps {
  name: string;
  age?: number;
  backstory: string;
  languages: string[];
  accounts: { channel: Channel; handle: string; status: AccountStatus }[];
  conversations?: number;
}

/** Personas get initials monograms, never faces. */
export function PersonaCard({ name, age, backstory, languages, accounts, conversations }: PersonaCardProps) {
  const initials = (name || "?")
    .split(/\s+/)
    .map((w) => w.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <article className="uk-persona">
      <div className="uk-persona-mono" aria-hidden>
        {initials}
      </div>
      <div>
        <h4>{name + (age ? ", " + age : "")}</h4>
        <p>{backstory}</p>
        <div className="uk-row gap-1 p-0">
          {languages.map((l) => (
            <span key={l} className="uk-badge uk-badge-neutral">
              {l}
            </span>
          ))}
        </div>
      </div>
      <div className="uk-persona-ft">
        {accounts.map((a) => (
          <span key={a.handle} className="uk-row gap-1 p-0">
            <span className="uk-mono text-xs">{a.channel + " " + a.handle}</span>
            <StatusBadge status={a.status} />
          </span>
        ))}
        {conversations != null ? <span className="uk-muted ml-auto text-xs">{conversations} live chats</span> : null}
      </div>
    </article>
  );
}
