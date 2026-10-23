"use client";

// Operator console state. Mock-backed for now; swap actions for /internal/* calls from the TRD.
import { createContext, useContext, useState, type ReactNode } from "react";
import { ACCOUNTS, CONVERSATIONS, ENTITIES, PERSONAS } from "@/lib/mock";
import type { AccountStatus, Channel, Conversation, Entity, EntityStatus, HoneypotAccount, Persona } from "@/lib/types";
import { nowHHMM } from "@/lib/utils";

export interface LogEntry {
  at: string;
  decision: EntityStatus;
  value: string;
}

interface OpsStore {
  entities: Entity[];
  convos: Conversation[];
  personas: Persona[];
  accounts: HoneypotAccount[];
  log: LogEntry[];
  decide: (st: EntityStatus) => (id: Entity["id"]) => void;
  toggle: (id: string) => void;
  send: (id: string, text: string) => void;
  close: (id: string) => void;
  addPersona: (f: Omit<Persona, "id">) => void;
  setAcc: (id: string, st: AccountStatus) => void;
  removeAcc: (id: string) => void;
  addAcc: (f: { channel: Channel; handle: string; persona: string }) => void;
}

const Ctx = createContext<OpsStore | null>(null);

export function useOps() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useOps must be used inside <OpsProvider>");
  return s;
}

export function personaName(personas: Persona[], id: string) {
  return personas.find((x) => x.id === id)?.name ?? "—";
}

export function OpsProvider({ children }: { children: ReactNode }) {
  const [entities, setE] = useState(ENTITIES);
  const [convos, setC] = useState(CONVERSATIONS);
  const [personas, setP] = useState(PERSONAS);
  const [accounts, setA] = useState(ACCOUNTS);
  const [log, setLog] = useState<LogEntry[]>([]);

  const patchC = (id: string, fn: (c: Conversation) => Conversation) =>
    setC((prev) => prev.map((c) => (c.id === id ? fn(c) : c)));

  const store: OpsStore = {
    entities,
    convos,
    personas,
    accounts,
    log,
    decide: (st) => (id) => {
      const e = entities.find((x) => x.id === id);
      setE((prev) => prev.map((x) => (x.id === id ? { ...x, status: st } : x)));
      setLog((prev) => prev.concat({ at: "today " + nowHHMM(), decision: st, value: e ? e.display || e.value : String(id) }));
    },
    toggle: (id) =>
      patchC(id, (c) => {
        const hum = c.status !== "human";
        return {
          ...c,
          status: hum ? "human" : "bot",
          stuck: false,
          msgs: c.msgs.concat({ dir: "system", text: hum ? "Operator took over" : "Handed back to bot" }),
        };
      }),
    send: (id, text) =>
      patchC(id, (c) => ({ ...c, time: nowHHMM(), msgs: c.msgs.concat({ dir: "out", time: nowHHMM(), text, human: true }) })),
    close: (id) =>
      patchC(id, (c) => ({ ...c, status: "closed", msgs: c.msgs.concat({ dir: "system", text: "Closed by operator" }) })),
    addPersona: (f) => setP((prev) => prev.concat({ id: "p" + (prev.length + 1), ...f })),
    setAcc: (id, st) => setA((prev) => prev.map((a) => (a.id === id ? { ...a, status: st } : a))),
    removeAcc: (id) => setA((prev) => prev.filter((a) => a.id !== id)),
    addAcc: (f) =>
      setA((prev) =>
        prev.concat({ id: "a" + Date.now(), ...f, status: "active", chats: 0, last: "—", age: "0 days" }),
      ),
  };

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}
