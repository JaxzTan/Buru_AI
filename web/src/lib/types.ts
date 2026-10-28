// Shapes the console works with. Field names follow the prototype; map from the Go API when it is wired in.

export type PersonaStatus = "draft" | "active" | "paused" | "retired";
export type ConvoStatus = "bot" | "operator" | "closed";
export type EntityStatus = "unverified" | "verified" | "rejected";
export type Confidence = "low" | "medium" | "high";
export type EntityType = "bank_account" | "wallet" | "phone" | "url" | "handle";
export type ScamType = "parcel" | "job" | "investment" | "impersonation" | "romance" | "loan" | "other";
export type AvatarTone = "mustard" | "blue" | "green" | "neutral";
export type Sender = "scammer" | "persona" | "operator";

export interface Persona {
  id: string;
  name: string;
  age: number;
  loc: string;
  occ: string;
  langs: string[];
  status: PersonaStatus;
  handle: string;
  created: string;
  backstory: string;
  wealth: string;
  av: AvatarTone;
  gen?: boolean; // made with "Generate persona" in this session (drives the demo path)
}

export interface Message {
  who: Sender;
  text: string;
  t: string;
}

export interface Conversation {
  id: string;
  scammer: string;
  personaId: string;
  scam: ScamType;
  status: ConvoStatus;
  stage: number; // index into STAGES
  last: string;
  msgs: Message[];
  web?: boolean; // started from the web chat page instead of Telegram
}

export interface Entity {
  id: string;
  type: EntityType;
  bank: string; // bank code for accounts, chain for wallets, "" otherwise
  value: string;
  scam: ScamType;
  status: EntityStatus;
  conf: Confidence;
  sightings: number;
  first: string;
  convoId: string | null;
  stageAt?: number;
  sample: boolean; // seeded row, always labelled SAMPLE
  note?: string;
}

export type LookupResult = "held" | "warn" | "sent";

export interface LookupResponse {
  match: boolean;
  confidence?: Confidence;
  scam_types?: ScamType[];
  first_seen?: string;
  sightings?: number;
}

export interface Lookup {
  result: LookupResult;
  entityId: string | null;
  res: LookupResponse;
  bank: string;
  amt: string;
  ms: number;
}

export interface BankDraft {
  bank: string;
  acct: string;
  amt: string;
}
