// Demo seed data. All fictitious: no real people, account holders are "SAMPLE TRADING" (spec §5.4).
import type { Conversation, Entity, Persona } from "./types";

export const SEED_PERSONAS: Persona[] = [
  { id: "p_17", name: "Ah Seng", age: 24, loc: "Klang", occ: "fresh grad", langs: ["BM", "Mandarin"], status: "active", handle: "@ahseng.wk", created: "26 Oct", backstory: "Job hunting after diploma, short on rent this month.", wealth: "RM2k–5k · high tech-savvy", av: "blue" },
  { id: "p_18", name: "Siti Aminah", age: 55, loc: "Kota Bharu", occ: "small trader", langs: ["BM", "Manglish"], status: "active", handle: "@kak_siti55", created: "25 Oct", backstory: "Runs a kuih stall, saving for Hajj.", wealth: "RM30k–60k · medium tech-savvy", av: "green" },
  { id: "p_12", name: "Uncle Wong", age: 68, loc: "Ipoh", occ: "retired", langs: ["Cantonese", "EN"], status: "paused", handle: "@wong_ipoh68", created: "23 Oct", backstory: "Retired lorry owner, lives alone, trusts phone calls.", wealth: "RM200k+ · low tech-savvy", av: "neutral" },
];

export const SEED_CONVOS: Conversation[] = [
  {
    id: "c_1031", scammer: "@poslaju_resend", personaId: "p_17", scam: "parcel", status: "bot", stage: 1, last: "08:12",
    msgs: [
      { who: "scammer", text: "Your parcel stuck at customs. Need pay RM8.90 redelivery fee.", t: "08:09" },
      { who: "persona", text: "eh which parcel ah? i order a lot from shopee lately", t: "08:12" },
    ],
  },
  {
    id: "c_1027", scammer: "@dr_invest_my", personaId: "p_18", scam: "investment", status: "operator", stage: 2, last: "07:55",
    msgs: [
      { who: "scammer", text: "Kak, guaranteed 30% return in 2 weeks. Many kakak already join.", t: "07:31" },
      { who: "persona", text: "betul ke? i ada sikit savings for hajj", t: "07:34" },
      { who: "scammer", text: "Deposit USDT to TQ7vR2pLx9sWm3Ke8dHy4Nc6Bf1Ja1u9xKp", t: "07:40" },
      { who: "operator", text: "usdt tu apa? anak saya kena tolong", t: "07:55" },
    ],
  },
  {
    id: "c_1019", scammer: "@kak_lina_loan", personaId: "p_12", scam: "loan", status: "closed", stage: 3, last: "Yest.",
    msgs: [
      { who: "scammer", text: "Loan approved RM20,000. Processing fee RM200 first.", t: "Yest." },
      { who: "persona", text: "aiya so fast approve ah? where i pay", t: "Yest." },
    ],
  },
];

export const SEED_ENTITIES: Entity[] = [
  { id: "e_870", type: "wallet", bank: "TRON", value: "TQ7vR2pLx9sWm3Ke8dHy4Nc6Bf1Ja1u9xKp", scam: "investment", status: "unverified", conf: "medium", sightings: 3, first: "24 Oct, 07:02", firstAt: Date.parse("2026-10-24T07:02"), convoId: "c_1027", stageAt: 2, sample: false },
  { id: "e_866", type: "phone", bank: "", value: "+60 11-2345 6789", scam: "impersonation", status: "unverified", conf: "medium", sightings: 2, first: "27 Oct, 06:15", firstAt: Date.parse("2026-10-27T06:15"), convoId: null, stageAt: 2, sample: true },
  { id: "e_861", type: "url", bank: "", value: "poslaju-track.my-parcel.top", scam: "parcel", status: "unverified", conf: "low", sightings: 1, first: "27 Oct, 21:40", firstAt: Date.parse("2026-10-27T21:40"), convoId: "c_1031", stageAt: 1, sample: true },
  { id: "e_840", type: "wallet", bank: "TRON", value: "TXa9mK2pQ7rLs4Wd8Hn3Ve6Bc1Yt5Zu3kWq", scam: "investment", status: "verified", conf: "high", sightings: 4, first: "22 Oct, 10:02", firstAt: Date.parse("2026-10-22T10:02"), convoId: null, sample: true },
  { id: "e_833", type: "phone", bank: "", value: "+60 12-555 0142", scam: "impersonation", status: "verified", conf: "high", sightings: 6, first: "20 Oct, 21:12", firstAt: Date.parse("2026-10-20T21:12"), convoId: null, sample: true },
  { id: "e_828", type: "url", bank: "", value: "jnt-redeliver.parcel-my.top", scam: "parcel", status: "verified", conf: "high", sightings: 3, first: "19 Oct, 18:05", firstAt: Date.parse("2026-10-19T18:05"), convoId: null, sample: true },
  { id: "e_820", type: "bank_account", bank: "CIMB", value: "800122334455", scam: "loan", status: "verified", conf: "high", sightings: 2, first: "18 Oct, 10:30", firstAt: Date.parse("2026-10-18T10:30"), convoId: null, sample: true },
  { id: "e_811", type: "handle", bank: "", value: "@vip_signal_my", scam: "investment", status: "rejected", conf: "low", sightings: 1, first: "17 Oct, 16:44", firstAt: Date.parse("2026-10-17T16:44"), convoId: null, sample: true },
];

// What "Generate persona" hands out in turn until the real LLM call is wired.
export const GENERATED: Omit<Persona, "id" | "status" | "handle" | "created">[] = [
  { name: "Mei Ling", age: 62, loc: "Penang", occ: "retired clerk", langs: ["Hokkien", "EN"], backstory: "Retired school clerk, widowed, two children in Singapore. Asks her nephew about apps.", wealth: "RM100k–300k · low tech-savvy", av: "mustard" },
  { name: "Encik Hafiz", age: 45, loc: "Shah Alam", occ: "lorry driver", langs: ["BM", "Manglish"], backstory: "Drives for a logistics firm, wants side income for his kids’ school fees.", wealth: "RM10k–30k · medium tech-savvy", av: "blue" },
  { name: "Aunty Lily", age: 66, loc: "Seremban", occ: "retired nurse", langs: ["Cantonese", "EN"], backstory: "Retired government nurse with pension, active in church WhatsApp groups.", wealth: "RM150k–250k · low tech-savvy", av: "green" },
  { name: "Kak Rohana", age: 58, loc: "Johor Bahru", occ: "canteen owner", langs: ["BM", "EN"], backstory: "Runs a school canteen, recently widowed, handles bills alone.", wealth: "RM40k–80k · low tech-savvy", av: "neutral" },
];

// Golden script for the web chat page (job scam).
export const SCRIPT: [label: string, text: string][] = [
  ["Opener", "Hi Auntie, our company need part-time reviewer. RM300 per day, only click like."],
  ["Deposit ask", "Can! First task need deposit RM150 to activate account, after that we return RM450."],
  ["Send account", "Maybank 5621 0384 11 name SAMPLE TRADING"],
  ["Push urgency", "Hurry Auntie, slot closing tonight! Transfer now ok?"],
];
