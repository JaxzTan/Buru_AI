// Props contract ported from unknown-frontend/src/index.d.ts
export type EntityType = "bank_account" | "wallet" | "phone" | "url" | "handle";
export type ScamType = "parcel" | "job" | "investment" | "impersonation" | "romance" | "other";
export type EntityStatus = "unverified" | "verified" | "rejected";
export type Stage = "rapport" | "bait" | "payment request" | "stall";
export type ConvoStatus = "bot" | "human" | "closed";
export type AccountStatus = "active" | "banned" | "cooldown";
export type Channel = "TG" | "WA";
export type Status =
  | EntityStatus
  | ConvoStatus
  | AccountStatus
  | "match"
  | "clear"
  | "revoked";

export interface Entity {
  id: number;
  type: EntityType;
  value: string;
  display?: string;
  bank?: string;
  scam_type: ScamType;
  confidence: number;
  sightings: number;
  last_seen: string;
  first_seen: string;
  status: EntityStatus;
  convo: string;
}

export interface Message {
  dir: "in" | "out" | "system";
  text: string;
  time?: string;
  human?: boolean;
  entities?: string[];
}

export interface Conversation {
  id: string;
  scammer: string;
  persona: string;
  channel: Channel;
  scam: ScamType;
  stage: Stage;
  status: ConvoStatus;
  time: string;
  stuck?: boolean;
  msgs: Message[];
}

export interface Persona {
  id: string;
  name: string;
  age: number;
  backstory: string;
  languages: string[];
  wealth: string;
  playbooks: ScamType[];
}

export interface HoneypotAccount {
  id: string;
  channel: Channel;
  handle: string;
  persona: string;
  status: AccountStatus;
  chats: number;
  last: string;
  age: string;
}

export interface Playbook {
  id: ScamType;
  reach: number[];
  /** [stage name, persona goal, example line] */
  stages: [string, string, string][];
}

export interface LookupResultData {
  match: boolean;
  confidence?: "high" | "medium" | "low";
  scam_types?: ScamType[];
  first_seen?: string;
  last_seen?: string;
  sightings?: number;
}

export interface Datum {
  k: string;
  v: number;
}
