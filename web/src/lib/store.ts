"use client";
// Demo data store. Data lives in the browser (localStorage) until the Go API is wired in.
// Each exported action is one swap point (spec Area 6):
//   generatePersona → POST /internal/personas/generate     setPersonaStatus → POST /internal/personas/{id}/status
//   scammerSends    → POST /internal/sim/messages (dev)     takeover/handback → POST /internal/conversations/{id}/takeover
//   operatorSend    → POST …/operator-message               decide → POST /internal/entities/{id}/verify
//   runLookup       → POST /v1/lookup via a server route, so the token stays server-side
// View state (selection, filters) is in the URL, not here (spec §4.2).
import { useSyncExternalStore } from "react";
import { clock, groupAcct, showVal, today, typeLabel } from "./format";
import { GENERATED, SEED_CONVOS, SEED_ENTITIES, SEED_PERSONAS } from "./seed";
import { classify, extract, lookup, personaReply } from "./sim";
import type { BankDraft, Conversation, EntityStatus, Lookup, PersonaStatus } from "./types";

const KEY = "sockabus-console-v1";

export interface Data {
  personas: typeof SEED_PERSONAS;
  convos: Conversation[];
  entities: typeof SEED_ENTITIES;
  pool: number; // how many personas "Generate" has handed out
  telegram: boolean;
  usedScript: number[];
  lastLookup: Lookup | null;
  bank: BankDraft;
}

export interface Toast {
  id: number;
  msg: string;
  label?: string;
  href?: string;
  run?: () => void;
}

interface UI {
  generating: boolean;
  genError: boolean;
  checking: boolean;
  typing: Record<string, boolean>;
  lastSync: number;
  toasts: Toast[];
}

export interface State {
  data: Data;
  ui: UI;
}

const seed = (): Data => ({
  personas: structuredClone(SEED_PERSONAS),
  convos: structuredClone(SEED_CONVOS),
  entities: structuredClone(SEED_ENTITIES),
  pool: 0,
  telegram: true,
  usedScript: [],
  lastLookup: null,
  bank: { bank: "MBB", acct: "", amt: "150.00" },
});

const freshUI = (lastSync: number): UI => ({ generating: false, genError: false, checking: false, typing: {}, lastSync, toasts: [] });

const SERVER: State = { data: seed(), ui: freshUI(0) };
let state: State | null = null;
const listeners = new Set<() => void>();

function load(): State {
  let data = seed();
  try {
    const saved = window.localStorage.getItem(KEY);
    if (saved) data = { ...data, ...JSON.parse(saved) };
  } catch {
    // private window or blocked storage: start from the seed
  }
  return { data, ui: freshUI(Date.now()) };
}

const get = () => (state ??= load());

function set(fn: (s: State) => State, persist = false) {
  state = fn(get());
  if (persist) {
    state = { ...state, ui: { ...state.ui, lastSync: Date.now() } };
    try {
      window.localStorage.setItem(KEY, JSON.stringify(state.data));
    } catch {
      // storage full or blocked: keep going in memory
    }
  }
  listeners.forEach((l) => l());
}

const setData = (fn: (d: Data) => Data) => set((s) => ({ ...s, data: fn(s.data) }), true);
const setUI = (patch: Partial<UI> | ((u: UI) => Partial<UI>)) =>
  set((s) => ({ ...s, ui: { ...s.ui, ...(typeof patch === "function" ? patch(s.ui) : patch) } }));

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useStore(): State {
  return useSyncExternalStore(subscribe, get, () => SERVER);
}

export const getState = get;

// ---------- derived ----------
export const queueOf = (d: Data) =>
  d.entities
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e.status === "unverified")
    .sort((a, b) => Number(a.e.sample) - Number(b.e.sample) || b.i - a.i)
    .map(({ e }) => e);
export const liveConvos = (d: Data) => d.convos.filter((c) => c.status !== "closed");
export const activePersonas = (d: Data) => d.personas.filter((p) => p.status === "active");

export function demoSteps(d: Data) {
  const mei = d.personas.find((p) => p.gen);
  const c = mei && d.convos.find((x) => x.personaId === mei.id && x.web);
  const e = c && d.entities.find((x) => x.convoId === c.id && x.type === "bank_account");
  return [
    { label: "Generate persona", done: !!mei, href: "/personas" },
    { label: "Activate", done: mei?.status === "active", href: "/personas" },
    { label: "Scammer chats", done: !!c && c.msgs.length > 1, href: "/demo/chat" },
    { label: "Account captured", done: !!e, href: "/demo/chat" },
    { label: "Human verifies", done: e?.status === "verified", href: "/verify" },
    { label: "Bank holds transfer", done: d.lastLookup?.result === "held", href: "/demo/bank" },
  ];
}

// ---------- toasts ----------
let toastId = 0;
export function toast(msg: string, action?: { label: string; href?: string; run?: () => void }) {
  const t: Toast = { id: ++toastId, msg, ...action };
  setUI((u) => ({ toasts: [...u.toasts, t] }));
  setTimeout(() => dismissToast(t.id), 6000);
}
export const dismissToast = (id: number) => setUI((u) => ({ toasts: u.toasts.filter((t) => t.id !== id) }));

// ---------- actions ----------
export function generatePersona(): Promise<string> {
  setUI({ generating: true, genError: false });
  return new Promise((resolve) =>
    setTimeout(() => {
      let id = "";
      setData((d) => {
        const g = GENERATED[d.pool % GENERATED.length];
        const pool = d.pool + 1;
        id = `p_${40 + pool}`;
        const handle = "@" + g.name.toLowerCase().replace(/[^a-z]/g, "").slice(0, 9) + g.age;
        return { ...d, pool, personas: [{ id, ...g, status: "draft", handle, created: "just now", gen: true }, ...d.personas] };
      });
      setUI({ generating: false });
      resolve(id);
    }, 1800),
  );
}

export function setPersonaStatus(id: string, to: PersonaStatus) {
  const p = get().data.personas.find((x) => x.id === id);
  if (!p) return;
  setData((d) => ({ ...d, personas: d.personas.map((x) => (x.id === id ? { ...x, status: to } : x)) }));
  toast(`${p.name} is ${to}`);
}

const updateConvo = (id: string, fn: (c: Conversation) => Conversation) =>
  setData((d) => ({ ...d, convos: d.convos.map((c) => (c.id === id ? fn(c) : c)) }));

export function takeover(id: string) {
  updateConvo(id, (c) => ({ ...c, status: "operator" }));
  setUI((u) => ({ typing: { ...u.typing, [id]: false } }));
}

export function handback(id: string) {
  updateConvo(id, (c) => ({ ...c, status: "bot" }));
  toast("Bot is replying again");
}

export function operatorSend(id: string, text: string) {
  const t = clock();
  updateConvo(id, (c) => ({ ...c, last: t, msgs: [...c.msgs, { who: "operator", text, t }] }));
}

export function decide(id: string, to: EntityStatus, note = "") {
  const e = get().data.entities.find((x) => x.id === id);
  if (!e) return;
  const prev = { status: e.status, conf: e.conf, note: e.note };
  const patch = (fields: Partial<typeof e>) =>
    setData((d) => ({ ...d, entities: d.entities.map((x) => (x.id === id ? { ...x, ...fields } : x)) }));
  patch({ status: to, conf: to === "verified" ? "high" : "low", note });
  const word = to === "verified" ? "Verified" : "Rejected";
  toast(`${word} ${typeLabel(e)} ${showVal(e)}${to === "verified" ? " — now high" : ""}`, { label: "Undo", run: () => patch(prev) });
}

// Scammer message from the web chat page. Returns the conversation id.
export function scammerSends(personaId: string, text: string): string | null {
  const d = get().data;
  const p = d.personas.find((x) => x.id === personaId);
  if (!p) return null;
  const t = clock();
  const kind = classify(text);
  const found = extract(text);
  let c = d.convos.find((x) => x.personaId === p.id && x.web);
  const isNew = !c;
  c ??= { id: `c_${1040 + d.convos.length}`, scammer: "@hr_parttime_job", personaId: p.id, scam: "other", status: "bot", stage: 0, last: t, msgs: [], web: true };
  const scam = c.scam === "other" && kind ? kind : c.scam;
  const stage = /deposit|pay|transfer|fee|bank in/i.test(text) ? Math.max(c.stage, 2) : c.stage;
  const convo: Conversation = { ...c, scam, stage, last: t, msgs: [...c.msgs, { who: "scammer", text, t }] };

  const entities = [...d.entities];
  let newId: string | null = null;
  for (const f of found) {
    const i = entities.findIndex((x) => x.type === f.type && x.bank === f.bank && x.value === f.value);
    if (i >= 0) {
      entities[i] = { ...entities[i], sightings: entities[i].sightings + 1, convoId: entities[i].convoId ?? convo.id };
    } else {
      newId = `e_${Math.random().toString(36).slice(2, 7)}`;
      entities.push({ id: newId, ...f, scam: scam === "other" ? (kind ?? "other") : scam, status: "unverified", conf: "medium", sightings: 1, first: `${today()}, ${t}`, convoId: convo.id, stageAt: Math.max(stage, 2), sample: false });
    }
  }
  setData((x) => ({ ...x, entities, convos: isNew ? [convo, ...x.convos] : x.convos.map((y) => (y.id === convo.id ? convo : y)) }));
  if (newId) toast("Entity extracted · now in the Verify queue", { label: "Open", href: `/verify?selected=${newId}` });

  if (convo.status === "bot") {
    setUI((u) => ({ typing: { ...u.typing, [convo.id]: true } }));
    const hasAcct = found.some((f) => f.type === "bank_account" || f.type === "wallet");
    // Real persona waits 10–30 s; the demo waits ~2 s.
    setTimeout(() => {
      setUI((u) => ({ typing: { ...u.typing, [convo.id]: false } }));
      const cur = get().data.convos.find((x) => x.id === convo.id);
      if (!cur || cur.status !== "bot") return;
      const [reply, next] = personaReply(cur, text, hasAcct);
      const rt = clock();
      updateConvo(cur.id, (x) => ({ ...x, stage: next, last: rt, msgs: [...x.msgs, { who: "persona", text: reply, t: rt }] }));
    }, 1600 + Math.random() * 1200);
  }
  return convo.id;
}

export const markScript = (i: number) =>
  setData((d) => (d.usedScript.includes(i) ? d : { ...d, usedScript: [...d.usedScript, i] }));

export const setBankDraft = (patch: Partial<BankDraft>) => setData((d) => ({ ...d, bank: { ...d.bank, ...patch } }));

export function fillBank(bank: string, acct: string) {
  setData((d) => ({ ...d, bank: { ...d.bank, bank, acct: groupAcct(acct) }, lastLookup: null }));
}

export const clearLookup = () => setData((d) => ({ ...d, lastLookup: null }));

export function runLookup() {
  setUI({ checking: true });
  setTimeout(() => {
    const d = get().data;
    const r = lookup(d.entities, d.bank.bank, d.bank.acct);
    setData((x) => ({ ...x, lastLookup: { ...r, bank: x.bank.bank, amt: x.bank.amt } }));
    setUI({ checking: false });
  }, 650);
}

export function cancelTransfer() {
  setData((d) => ({ ...d, bank: { ...d.bank, acct: "" } }));
  toast("Transfer cancelled. Money stayed with the customer");
}

export function toggleTelegram() {
  const up = !get().data.telegram;
  setData((d) => ({ ...d, telegram: up }));
  toast(up ? "Telegram reconnected · recovery alert sent" : "Alert sent to team Telegram group and email");
}

export function resetDemo() {
  set(() => ({ data: seed(), ui: freshUI(Date.now()) }), true);
  toast("Demo data reset");
}

