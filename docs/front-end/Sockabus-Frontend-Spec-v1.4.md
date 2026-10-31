# Sockabus v1.0 — Frontend Spec

| Field | Value |
|---|---|
| Prepared for | Frontend lead, Sockabus (formerly Buru AI) |
| Based on | PRD v1.0, TRD v1.0, Blueprint v1.0 (26 Oct 2026), "Unknown Figma.pdf", Sockabus bunting |
| Version | 1.4 |
| Last updated | 30 Oct 2026 |
| Demo date | Mon 2 Nov 2026 (bank meeting) |
| Audience feeling we design for | **Trustable · Reliable · Simple · Logical (shows its reasoning) · User friendly** |
| Design rule from lecturer | **"One more step, lose a customer."** Every extra click must earn its place. |

**Revision history**

| Version | Date | Changes |
|---|---|---|
| 1.0 | 28 Oct 2026 | Areas 2–5: features, user flow, visual requirements, Figma review. |
| 1.1 | 28 Oct 2026 | Renamed to **Sockabus**. Added design system (§4.1), URL-state rule (§4.2), one-step shortcuts, amber "Check before sending" lookup result (§4.3 S5), Figma + prototype deliverables (Area 6), open decisions (Area 7). Sample data cleaned (no realistic names on accounts). |
| 1.2 | 29 Oct 2026 | Prototype rebuilt as Next.js pages in `web/` (Area 6.1). Old `/operator/*` and `/portal/*` pages and the Go-embedded HTML frontend removed. `NEXT_PUBLIC_DEV_CHAT` flag behaviour, self-hosted fonts, Tailwind removed. Swap list now points to `src/lib/store.ts` / `sim.ts`. Next steps updated (Area 6.3). |
| 1.3 | 29 Oct 2026 | Decisions closed by Jaxz. **D1 dropped:** no amber "Check before sending" result; S5 shows only Held / Sent, as in the PRD. **D3 adopted:** Undo after Verify/Reject delays the API call 6 s on the client (§4.5). Code changes listed in Area 6.3. |
| 1.4 | 30 Oct 2026 | All screens wired to the live Go API (sample mode kept as fallback). Added Dashboard at `/`, sign-in / sign-out, sidebar toggle, persona Modify panel, narrow conversation list, Verify → bank simulator in one click, bank "Why flagged" summary + client panel, sample-data banner. Honest Verify ticks. Redirect + cookie fixes for Docker / Caddy. Full e2e pass in live and sample mode (Area 6.4). Leader's design reference merged (Area 6.2). |
| 1.4 (rev.) | 30 Oct 2026, 22:20 | Dashboard re-laid out to match the leader's design: two columns, "Summary · today" card in fixed sentences (no AI text, no Model box); pipeline, latest-verified and scam-type chart removed from the Dashboard (chart stays on the bank page). Web chat matches the design ("Talking to" inline in the header, "You are talking to" card). **Demo path bar removed.** Tests: live 26/26, sample 25/25. |

> **Status at 30 Oct:** all screens run against the **live Go API** on `localhost:3000` (Docker), with sample mode as a fallback. The full demo path passes an automated browser test in both modes (Area 6.4). Remaining work is backend / ops (Area 6.5) and rehearsal.

> How to read this: Area 2 = *what* to build and *why*. Area 3 = *how a user moves through it*. Area 4 = *what each screen must contain and how it looks*. Area 5 = *review of the old Figma*. Area 6 = *what is already built*. Area 7 = *decisions*.

---

## Area 2 — Features to build, reasons, and the core

### 2.1 How "core" is decided

A feature is **CORE** if removing it breaks the chain below. Nothing reaches the bank, so the program has no output:

```
Persona exists → Scammer can reach it → Persona replies → Entity extracted → Human verifies → Bank looks it up
```

Everything else either makes the chain *better* (Important), is needed to *prove* the chain in the demo (Demo-required), or is *later*.

### 2.2 Feature list

| # | Feature | Req ID | Screen | Tier | Why we need it |
|---|---|---|---|---|---|
| F1 | Generate persona (1 click) | FR-15, FR-1 | S1 Personas | **CORE** | No persona means nothing for a scammer to talk to. One click proves "scale" to the bank in 30 s. |
| F2 | Activate / pause persona (draft → active → paused → retired) | FR-1 | S1 | **CORE** | A draft persona does not answer. Activate is the switch that turns it on. |
| F3 | Channel: Telegram honeypot **or** web chat fallback | FR-2, TR-22 | (phone) / S7 Web chat | **CORE** | The scammer must be able to send a message in. Web chat is also the test entry point (TC-19). Go/no-go Fri 30 Oct 12:00. |
| F4 | Persona auto-reply with human delay (≥ 10 s) | FR-3 | S2 (watched) | **CORE** | Without replies, the scammer never reaches the payment step. Delay = realism. |
| F5 | Entity extraction (bank account, wallet, phone, URL, handle) | FR-6 | S2 + S3 | **CORE** | This is the product. Turns chat text into searchable intelligence. |
| F6 | Verify / Reject queue | FR-9 | S3 Verify | **CORE** | Only verified = high confidence. Human-in-the-loop is our main trust argument and protects innocent account holders from false positives. |
| F7 | Lookup (single) via bank simulator | FR-10 | S5 Bank simulator | **CORE** | The moment of value: "transfer held". Without it, the bank sees no benefit. |
| F8 | Playbook steering + stage tracker (rapport → bait → payment request → stall) | FR-4, TR-4 | S2 | Important | The chain *runs* without it, but far fewer scammers reveal accounts (target ≥ 40% reach payment stage). The tracker also *explains* the bot's logic visually. |
| F9 | Live conversation view | FR-5 | S2 | Demo-required | The bank must *see* the scammer being fooled; otherwise it is a black box. |
| F10 | Take over / hand back + operator send | FR-5 | S2 | Demo-required (backup) | Answers the bank's #1 worry: "what if the AI says something wrong?" |
| F11 | Scam-type classification (parcel, job, investment, impersonation, romance, **loan**, other) | FR-7 | S2, S3, S4, S5 | Important | Lookup still works without it, but "Job scam" on the held banner is far more convincing. |
| F12 | Entity list with type/status filters | FR-11 (basic) | S4 Entities | Demo-required | Shows the database is growing and auditable. No chart/CSV in v1.0. |
| F13 | Status page (Telegram connected, last message, LLM errors, workflows) | NFR-9, TR-20 | S6 Status | Demo-required | "Reliable" is a claim; the status page is the proof. |
| F14 | Loading / empty / error states on every screen | Blueprint §5, §11 | All | Demo-required | A frozen or blank screen during a live demo destroys trust faster than any bug. |
| F15 | `data-testid` on all listed elements | NFR-10, TR-21 | All | Demo-required | CI cannot merge without them; tests guard demo day. |
| **F16** | **URL state: page, selection and filters live in the URL** | Team lead request | All | Demo-required | A reload or shared link opens the same view. Losing your place on reload costs a step (see §4.2). |
| **F17** | **One-step shortcuts** (Activate in the "persona ready" banner, Verify inside the chat, quick-fill on bank form, keyboard V/R/J/K, Undo toast) | Lecturer rule | S1, S2, S3, S5 | Important | Removes page switches and confirmation pop-ups from the demo path. |
| ~~F18~~ | ~~Demo path bar~~ | — | — | **Removed 30 Oct** | Not in the leader's design. The top strip now holds only the Hide/Show menu button. |
| **F19** | **Dashboard at `/`** (tiles with plain-words descriptions, active chats, persona cards, "Summary · today", next in the Verify queue, system strip) | Jaxz request | Dashboard | Demo-required | One screen the bank understands in 10 seconds; every number live and clickable |
| **F20** | **Sign-in / sign-out** (username + password, cookie, all pages and `/api/*` gated) | Leader design | `/sign-in` | Demo-required | The console must not be open to anyone with the link once deployed |
| **F21** | **Sidebar show/hide** (saved per browser) | Jaxz request | All | Important | More room for the chat and tables |
| **F22** | **Persona Modify panel** (full profile: identity, home, background, family, money, languages) | Leader design | S1 | Important | Shows how believable a persona is |
| **F23** | **Bank "Why flagged" summary + client panel** (built from real data, no AI text) | Leader request | S5 | Demo-required | Lets the bank understand *why* the transfer was held |
| — | Wallet trace, webhooks, API keys, usage, trends, CSV, batch lookup, TOTP login, customer portal | FR-8, 11, 12, 13 | — | **Not v1.0** | Blueprint §13 says don't build. |

### 2.3 Core in one line
**F1 + F2 + F3 + F4 + F5 + F6 + F7.** For frontend this means screens **S1, S3, S5** are non-negotiable, plus **S7** if Telegram is no-go, and **S2** because it's the only way the operator (and the bank) can see F4/F5 happen.

### 2.4 Build order
**S5 → S3 → S1 → S2 → S7 → S6 → S4.** S5 and S3 are the climax of the demo and the cheapest to build; if time runs out, you still have the ending. S4 is the first thing to cut.

---

## Area 3 — User flow (Step 1 to N)

**Goal:** a bank transfer to a scammer's account is held *before* the money leaves.
**Actors:** Operator (dashboard) · Scammer (teammate, phone or S7) · Bank user (S5 simulator).

| Step | Actor | What the user DOES | What the user SEES | Feature / screen | Test IDs |
|---|---|---|---|---|---|
| 1 | Operator | Opens dashboard → Personas | Persona table, or empty state "No personas yet — generate one" | S1 | `persona-row` |
| 2 | Operator | Clicks **+ Generate persona** | Button disables: spinner "Generating… up to 30 s" | F1 | `persona-generate-btn`, `persona-generate-loading` |
| 3 | System | — | Mustard banner "New persona ready — Mei Ling, 62 · Penang" with backstory and honeypot handle. New row at top, status DRAFT. On failure: red banner "Couldn't generate a persona… Try again", nothing saved | F1 | `persona-name`, `persona-status`, `persona-generate-error` |
| 4 | Operator | Clicks **Activate now** *in the banner* (no hunting for the row) | Badge DRAFT → ACTIVE; banner turns green: "Mei Ling is live on @meiling62 · Chat as scammer →" | F2, F17 | `persona-activate-btn` |
| 5 | Scammer | Sends opener via Telegram, or taps script button **1 Opener** + **Send** on S7 | Own bubble (navy, right). S2: new conversation row, status BOT | F3, F9 | `webchat-send-btn`, `convo-row`, `convo-status` |
| 6 | System | Persona waits 10–30 s, replies | "Mei Ling is typing…", then "wah really ah? i retired already…". Stage RAPPORT → BAIT | F4, F8 | `chat-message`, `chat-message-sender` |
| 7 | Scammer | Asks for deposit, then sends "Maybank 5621 0384 11 name SAMPLE TRADING" | Stage → PAYMENT REQUEST. Toast "Entity extracted · now in the Verify queue · Open". Inline card in chat: "Bank · MBB · 5621 0384 11 · UNVERIFIED · MEDIUM" with **Reject / Verify** buttons | F5, F8, F11 | `chat-message` |
| 8 | Operator *(optional)* | **Take over** → types → **Send** → **Hand back to bot** | Purple bar "You are replying as Mei Ling". Bubble labelled OPERATOR. Bot stops instantly | F10 | `takeover-btn`, `operator-input`, `operator-send-btn` |
| 9 | Operator | Clicks **Verify** right in the chat card, *or* opens Verify queue (newest captured item is pre-selected) and presses **V** | Evidence panel: why flagged (4 checks), source excerpt with the number highlighted, optional note | F6, F17 | `entity-row`, `entity-value`, `entity-confidence`, `verify-btn` |
| 10 | System | — | Toast "Verified Bank · MBB 5621 0384 11 — now high · **Undo**". Row leaves queue; nav count −1. Chat card turns green with "Try it in bank simulator →". The save reaches the server after the 6 s Undo window (§4.5) | F6 | `verify-toast`, `verify-undo-btn` |
| 11 | Bank user | Opens Bank simulator → taps quick-fill **Account captured from chat** → **Transfer RM 150.00** | "Checking recipient with Sockabus…" | F7, F17 | `bank-select`, `account-input`, `amount-input`, `transfer-btn` |
| 12 | System | Server route calls `/v1/lookup` | **Red "Transfer held"**: linked to a Job scam · High · human-verified · seen 1 time · first seen · checked in 41 ms. Buttons: Edit recipient / Cancel transfer. "Behind the scenes" panel explains the 3 steps and shows the JSON | F7, F11 | `result-held` |
| 12b | Bank user | Tries a clean account | Green "Transfer sent — no scam record. Checked in 18 ms" | F7 | `result-sent` |
| 13 | Operator | Opens Status | "All systems operational", tiles: Telegram connected, last message, AI model 0 errors, conversations running, lookup API, backend health | F13 | `status-telegram`, `status-last-message`, `status-llm-errors`, `status-workflows` |

**Logic chain the audience should be able to repeat back:** *fake victim → scammer talks → account captured → human confirms → bank blocked.* Every screen points to the next step with one button.

**Steps saved vs v1.0 flow:** Activate from the banner (−1 search), Verify inside the chat (−1 page switch), quick-fill on the bank form (no typing on stage), Undo instead of a confirm pop-up (−1 click per decision; see §4.5).

---

## Area 4 — Visual technical requirements

### 4.1 Design system (from the Sockabus bunting)

**Colour tokens** (Figma variables `Sockabus / Color`, CSS custom properties in `styles.css`)

| Token | Hex | Use |
|---|---|---|
| `ink` | `#111A2E` | Text, sidebar, scammer bubbles |
| `ink-2` | `#2A3349` | Secondary dark surfaces |
| `muted` | `#5A6275` | Secondary text (5.5:1 on paper) |
| `paper` | `#F6F2E9` | Page background |
| `paper-2` | `#EDE6D6` | Bands, neutral badges |
| `line` | `#E2DACB` | Borders |
| `card` | `#FFFFFF` | Cards, persona bubbles |
| `mustard` | `#F0A93B` | **The one primary action per screen**, active nav |
| `mustard-soft` | `#FCEFD6` | "Needs attention" surfaces |
| `hunt` | `#D42A1F` | Brand accent, nav counts |
| `red` / `red-soft` | `#C62A1F` / `#FCE6E3` | Stop, held, rejected, down |
| `green` / `green-soft` | `#1F7A4D` / `#E2F3EA` | Verified, safe, up |
| `amber` / `amber-soft` | `#9A5B00` / `#FCEFD6` | Unverified, medium, needs a human |
| `blue` / `blue-soft` | `#2F55C9` / `#E7ECFB` | Bot, info, links |
| `purple` / `purple-soft` | `#6A3DC4` / `#EFE8FB` | Operator / human takeover |

**Type**

| Role | Font | Use |
|---|---|---|
| Display | Archivo Black | Page titles, big result words ("Transfer held"). Matches "WE HUNT SCAMMERS" |
| UI | Archivo 400/500/600/700 | All interface text |
| Data | JetBrains Mono | Account numbers, wallets, URLs, handles, JSON — so 0/O and 1/l are never confused |

Scale: Display 40/28 · Heading 20/16 · Body 14/13 · Label caps 11 (+6% tracking).

**Components**

| Component | Variants | Rule |
|---|---|---|
| Button | Primary (mustard) · Secondary (outline) · Success (green, Verify) · Danger (red) · Quiet (link) | One Primary per screen |
| Badge | Neutral · Success · Warning · Danger · Info · Operator | Always dot + CAPS word; never colour alone (WCAG 1.4.1) |
| Scam chip | PARCEL · JOB · INVESTMENT · IMPERSONATION · ROMANCE · LOAN · OTHER | Outlined, neutral |
| Avatar | Initials only | No photos or AI faces for personas |
| Logo | Mascot PNG (`assets/logo.png`) + "Sockabus" wordmark + mustard bar | One component, used in sidebar and favicon |
| Toast | Message + optional action (Undo / Open) | 6 s, bottom-right, `aria-live`. Undo toasts follow §4.5 |

**Badge vocabulary (single source of truth)**

| Group | Values | Tone |
|---|---|---|
| Persona | DRAFT · ACTIVE · PAUSED · RETIRED | neutral · success · warning · neutral |
| Conversation | BOT · OPERATOR · CLOSED | info · operator · neutral |
| Entity status | UNVERIFIED · VERIFIED · REJECTED | warning · success · danger |
| Confidence | LOW · MEDIUM · HIGH | neutral · warning · success — **words, never %** |
| Lookup | HELD · SENT | danger · success |
| Data origin | LIVE · SAMPLE | info · neutral — seeded rows are always labelled |

### 4.2 URL state (team lead requirement)

Everything a user would expect to survive a reload lives in the URL. Reload or a shared link opens the same view.

| Screen | Route | Query state |
|---|---|---|
| Sign-in | `/sign-in` | `?next=<path>&error=wrong` (`next` must start with a single `/`) |
| Dashboard | `/` | none |
| S1 Personas | `/personas` | `?status=all\|active\|draft\|paused&new=<personaId>&selected=<personaId>` |
| S2 Conversations | `/conversations/[id]` | `?status=all\|bot\|operator\|closed` |
| S3 Verify | `/verify` | `?selected=<entityId>` |
| S4 Entities | `/entities` | `?type=…&status=…&q=…` |
| S5 Bank simulator | `/demo/bank` | `?entity=<entityId>` (pre-fills the account; the number itself never goes in the URL) |
| S6 Status | `/status` | none |
| S7 Web chat | `/demo/chat` | `?persona=<personaId>` |

`/` is the Dashboard (no longer a redirect). ✅ Implemented in `web/` via `useQuery` in `src/lib/hooks.ts`. Sidebar open/closed is a personal preference, so it lives in `localStorage`, not the URL.

**Implementation (Next.js App Router):** selected item in the path segment (`/conversations/[id]`); filters via `useSearchParams` + `router.replace()` (replace, not push, so Back doesn't step through every filter click).

**Never in the URL:** account numbers, wallet addresses, phone numbers, message text, tokens. URLs end up in browser history, logs and screenshots (PRD NFR-4). This is why S5 passes an entity ID, not the account number, and why S4 search `q` should be cleared before sharing a link in a public deck.

### 4.3 Screens

**Legend:** 🟢 REAL (live backend) · 🟡 REAL CALL, FAKE CONTEXT (e.g. pretend bank) · 🔴 SEED (fixed sample data, labelled SAMPLE, never real people)

**Global (all screens)**

| Part | Content | Real/fake | Notes |
|---|---|---|---|
| Sidebar (navy) | Logo + wordmark; Operate: Personas, Conversations (live count), Verify queue (pending count), Entities, Status; Demo: Bank simulator, Web chat; mini status card (same live data as Status, no fixed text); signed-in username; **Sign out**; show/hide toggle | 🟢 counts | Web chat only when `NEXT_PUBLIC_DEV_CHAT=true`. **No "TOTP"** — not built (G-7) |
| Mobile | Sidebar becomes a top bar with a horizontally scrolling nav | — | No horizontal page scroll at 400 px |
| States | Spinner on long actions, empty state with the next action, error with retry | — | Blueprint §11 |

**Sign-in `/sign-in`**

| Screen part | Content | Real/fake |
|---|---|---|
| Left panel (navy) | Logo, "The operator console for a scam honeypot.", 3 one-line promises, "Sockabus Console · demo build" | — |
| Form | Work email / username, password, **Sign in →**; "Operators only."; "Forgot your password? Ask an admin." No 6-digit code (not built) | 🟢 checked on the server against `SOCKABUS_CONSOLE_USER` / `SOCKABUS_CONSOLE_PASSWORD` |
| Rules | httpOnly cookie (Secure behind HTTPS via `X-Forwarded-Proto`); middleware gates every page and `/api/*`; redirects use the browser's host (`X-Forwarded-Host` / `Host`), never the container's `0.0.0.0` | — |

**Dashboard `/`** — two columns (stacks to one below 1100 px; tiles stay 4 across at 1440 px)

| Column | Screen part | Content | Real/fake |
|---|---|---|---|
| Top | Header | "What the honeypot did today, and what needs a human next." + **Review N in queue →** | 🟢 |
| Left | 4 tiles, each with a plain-words line | Live conversations · Waiting for a human · Entities captured · Active personas | 🟢 |
| Left | Active chats | Handle → persona, stage, last message, scam chip, status, "N captured", "Open Conversations →" | 🟢 |
| Left | Persona cards | Name, place, status, honeypot, live chats; **Profile →** / **Chat as scammer →** | 🟢 |
| Right | **Summary · today** | Counts (persona replies, auto-extracted by confidence) + "What happened" lines written from real data with **fixed sentences**. A note on the card says no AI wrote it. **No "Model" box** (the backend doesn't report the model) | 🟢 |
| Right | Next in the Verify queue | Oldest unverified items with confidence, time, Review / Verify (6 s Undo) | 🟢 |
| Right | System | `/readyz` + Telegram account state, link to Status | 🟢 |
| — | Removed 30 Oct | Pipeline, Latest verified accounts, scam-type bar chart (not in the design; the chart stays on the bank page) | — |

**S1 — Personas `/personas`**

| Screen part | Content | Sample data | Real/fake |
|---|---|---|---|
| Header + **+ Generate persona** (mustard) | Spinner "Generating… up to 30 s" while busy | — | 🟢 |
| "Persona ready" banner | Name, age, place, backstory, wealth band, languages, honeypot handle; **Generate another** / **Activate now** | "Mei Ling, 62 · Penang · retired clerk · RM100k–300k" | 🟢 LLM-generated |
| After activate | Green banner "Mei Ling is live on @meiling62" + **Chat as scammer →** (demo build) | — | 🟢 |
| Filter tabs | All / Active / Draft / Paused with counts | — | 🟢 |
| Table | Name (initials avatar), languages (chips), status, honeypot handle, created, Activate / Pause | 3–4 rows | 🟢 |
| Error banner | "Couldn't generate a persona… nothing was saved" + Try again. Missing AI key (503) shows a "not set up" banner | — | 🟢 |
| **Modify** → detail panel (`?selected=`) | Identity (name, nickname, age, gender, ethnicity, religion) · Lives in · Background · Family · Money · Languages as % bars · Honeypot & activity. Missing fields are hidden | "Lim Siew Mei, called Auntie Mei, 62 · Jelutong, George Town · RM180k Public Bank FD · EN 50% / Hokkien 30% / BM 20%" | 🟢 |
| Footer note | "Generated personas never use real people's names, IDs or photos" | — | — |

**S2 — Conversations `/conversations/[id]`**

| Screen part | Content | Sample data | Real/fake |
|---|---|---|---|
| Live pill | "LIVE · updated 2 s ago" (3 s poll) | — | 🟢 |
| Left list (≈220 px) + filter tabs | Persona name, status dot, time only; the chat gets the rest of the width | "Auntie Mei · ● · 14:25" | 🟢 |
| Chat header | Avatar, handle → persona, channel + honeypot, scam chip, status badge | — | 🟢 |
| Stage tracker | RAPPORT → BAIT → PAYMENT REQUEST → STALL, current in mustard | — | 🟢 |
| Bubbles | Scammer = navy, left. Persona = white outlined, right. Operator = purple, right. Each with sender + time | Golden script | 🟢 |
| Typing indicator | "Mei Ling is typing…" during the human delay | — | 🟢 |
| Inline entity card | Unverified (dashed mustard) with **Reject / Verify**; Verified (green) with "Try it in bank simulator →"; Rejected (grey, "kept for audit") | "Bank · MBB · 5621 0384 11" | 🟢 |
| Footer | Bot mode: "Bot is replying with a 10–30 s human delay" + **Take over**. Operator mode: purple bar, input, Send, **Hand back to bot**. Closed: note only | — | 🟢 |

**S3 — Verify queue `/verify`**

| Screen part | Content | Sample data | Real/fake |
|---|---|---|---|
| Header | Keyboard hint "V verify · R reject · J/K next" | — | — |
| Queue list | Newest live item first, pre-selected. Type, value, scam chip, confidence, sightings, SAMPLE badge if seeded | — | 🟢 |
| Evidence panel | Big mono value; facts (sightings, first seen, source chat, channel) | — | 🟢 |
| "Why the system flagged this" | Only checks backed by data: "Sent by the scammer" from the source message's sender; "Passed the bank-number check (every saved account does)" (and matching lines for wallets, phones, links, handles); sightings count. Stage line hidden when unknown | — | 🟢 |
| Source excerpt | 2 messages, the value highlighted in red mono; "Open full chat →" | — | 🟢 |
| Note + actions | Optional note; "After you verify: confidence becomes high…"; **Reject (R)** / **Verify (V)** | — | 🟢 |
| Toast | "Verified … — now high · Undo". The API call waits until the toast closes (§4.5) | — | 🟢 |
| Next step | **Test in bank simulator →** (`/demo/bank?entity=`) after Verify, also on the chat card and Dashboard | — | 🟢 |
| Empty state | "Queue clear — nothing is waiting for a human" + See all entities / Test in bank simulator | — | — |

**S4 — Entities `/entities`**

| Screen part | Content | Sample data | Real/fake |
|---|---|---|---|
| Filters | Search box, Type dropdown, Status dropdown | — | 🟢 |
| Table | Type, value (mono) + LIVE/SAMPLE badge, scam chip, confidence, status, sightings, first seen, "View chat →" | demo entity + 5–7 seeded | 🟢 + 🔴 |
| Empty state | "No entities match" + Clear filters | — | — |
| Footer | "N shown · X live from chats, Y labelled sample" · "Trend chart and CSV export come after v1.0" | — | — |

**S5 — Bank simulator `/demo/bank`**

| Screen part | Content | Sample data | Real/fake |
|---|---|---|---|
| Badge | "DEMO ONLY · NOT A REAL BANK" | — | — |
| DemoBank card | Grey header "DemoBank · Online transfer · Savings ••• 4410". Bank (MBB, CIMB, PBB, RHB as **text, no logos**), account number (mono), amount | Maybank · 5621 0384 11 · RM 150.00 | 🟡 |
| Quick fill / pre-fill | Arriving with `?entity=` fills bank + account. Quick fill: Account captured from chat (live) · Known loan-scam account · Clean account (fixed). If that entity's decision is still in the Undo window, it is saved first and **Transfer is locked until the save succeeds** | — | 🟡 |
| **Transfer RM x** | Spinner "Checking recipient with Sockabus…"; validation if < 10 digits | — | 🟡 |
| Result — **held** (red) | "Transfer held", scam type, confidence High · human-verified, seen N times, first seen, checked in N ms; Edit recipient / Cancel transfer | — | 🟢 real `/v1/lookup` |
| Result — **sent** (green) | "Transfer sent — no scam record. Checked in 18 ms" | — | 🟢 |
| "Why Sockabus flagged this account" | Fixed sentence templates filled from real data: scammer handle, persona, date/time, stage, scam type, verified time if known, sightings + short scammer excerpt. **No AI-written text.** Fields without data are hidden | — | 🟢 |
| Client panel | Lookup result and time · total verified accounts · accounts by scam type (bar chart) · lookups and holds labelled "this demo session" | — | 🟢 |
| Behind the scenes (navy panel) | 3 numbered steps that change with the result + live JSON response; "The lookup token stays on our server" | — | 🟢 |
| Result rule | **Two results only** (D1 closed). `match: true` → Held, `match: false` → Sent. The held banner shows the `confidence` the API returns, so the rule "only a human sets high" stays visible. In the demo the account is always verified before the transfer, so it reads "High · human-verified" | — | — |

**S6 — Status `/status`**

| Screen part | Content | Sample data | Real/fake |
|---|---|---|---|
| Overall banner | Green "All systems operational · last checked Xs ago" / Red "Degraded: Telegram disconnected — team alerted, demo can continue on Web chat" | — | 🟢 (10 s poll) |
| Tiles (6) | Telegram honeypot · Last message received · AI model errors (15 min) · Conversations running · Lookup API latency · Backend health | — | 🟢 |
| Uptime 24 h | 24 hourly bars (green / amber / red) + one-line explanation of any non-green hour | — | 🟢 Uptime Kuma |
| Alerting card | "Team gets a Telegram and email alert within 2 minutes" + last drill result | — | 🟢 |
| Open uptime monitor ↗ | Links to `status.<domain>` (Uptime Kuma) | — | 🟢 |
| Live-mode tiles without a data source | AI model, Lookup API, uptime history show "Not reported" / "not connected yet" instead of numbers | — | — |
| Simulate toggle | "Simulate: Telegram drops / reconnect" | — | **Sample mode only** |

**S7 — Web chat `/demo/chat`**

| Screen part | Content | Sample data | Real/fake |
|---|---|---|---|
| Header (dark) | "TALKING TO" persona picker inline (active only) | "Auntie Mei (active)" | 🟢 |
| Chat | Messenger look: scammer = you (navy, right), persona (white, left), typing indicator | Golden script | 🟢 real gateway |
| Golden script buttons | 1 Opener · 2 Deposit ask · 3 Send account · 4 Push urgency (fill the box; used ones tick off) | — | — |
| Composer | Input + Send | — | 🟢 |
| "You are talking to" card (right) | Name, age, place, job, backstory · Honeypot · Playbooks · Live chats · languages · "Captured from your messages" with status and confidence · "See this chat in Conversations →". **Bait** box shows only if the persona profile has a bait field (none do yet) | — | 🟢 |
| Helper card (below the profile card) | When to use this page (go/no-go line removed) | — | — |
| Empty state | "No active personas — activate one first" + Go to Personas → | — | — |

### 4.4 Design principles for the five feelings

| Feeling | What to do on screen |
|---|---|
| **Trustable** | Every flag shows *why* (checks, source excerpt, sightings, who verified). Label seeded data SAMPLE. Never claim features we don't have (TOTP) or numbers we can't back (vanity KPIs). |
| **Reliable** | Status page, "updated X s ago" on live views, spinners not blank screens, errors that say what happened and what to do. |
| **Simple** | One mustard action per screen. One badge vocabulary. Red = stop, amber = needs a human, green = safe. |
| **Logical** | Stage tracker; confidence rule shown in words ("auto stops at medium, a human sets high"); "Behind the scenes" panel on S5. |
| **User friendly** | Next action is always one click away (banner buttons, inline Verify, quick fill, keyboard shortcuts, Undo). Reload keeps your place (§4.2). |

### 4.5 Undo after Verify / Reject (D3)

The operator never sees an "Are you sure?" pop-up. Verify and Reject act at once on screen, and the save to the server waits until the Undo chance has passed. Reason: `verifications` is append-only (NFR-8), so a decision that is undone must never reach the database.

| # | Moment | What the user sees | What the code does |
|---|---|---|---|
| 1 | Click **Verify** / **Reject**, or press **V** / **R** | Row leaves the queue, nav count −1, chat card turns green / grey. Toast "Verified … — now high · **Undo**" | Update local state only. Start a 6 s timer for this entity. No API call yet |
| 2 | Click **Undo** within 6 s | Row comes back where it was, count +1, toast "Undone" | Cancel the timer. No API call is ever made |
| 3 | 6 s pass | Toast closes. Nothing else changes | Send `POST /internal/entities/{id}/verify` with `{ "decision", "note" }` |
| 4 | That call fails | Row returns to the queue. Error toast with the API `message` + **Retry** | Undo the local change. Retry resends the same decision |
| 5 | Operator leaves the page or closes the tab during the 6 s | — | Send every pending decision at once: on route change, and on `pagehide` with `fetch(..., { keepalive: true })`. A decision the operator made is never lost |
| 6 | Several quick decisions (V, V, V) | One toast per decision, each with its own Undo | One timer per entity. Undo cancels only that entity's decision |

**Rules**
- Undo window: `NEXT_PUBLIC_UNDO_MS`, default `6000`. Set it to `0` in CI so tests don't wait (same idea as `BURU_REPLY_DELAY_MIN=0`).
- The bank simulator only sees the verified result once the call is sent. Live demo: after Verify, let the toast close (or wait 6 s) before pressing Transfer. Add this line to Andy's demo checklist.
- Test IDs: `verify-toast`, `verify-undo-btn`.
- Tests: TC-14 and TC-15 run with `NEXT_PUBLIC_UNDO_MS=0`. Add one UI test: Verify → Undo → no row in `verifications`, entity still `unverified`.

---

## Area 5 — Review of the "Unknown" Figma (from v1.0, still valid)

### 5.1 Keep
Stage tracker; inline "entity extracted" card; takeover states; verify state changes with pending counter; lookup result fields (match `/v1/lookup` field-for-field); component sheet; persona card with languages; Manglish chat sample.

### 5.2 Gaps vs v1.0 — status after the new design

| # | Issue in old Figma | Status in Sockabus design |
|---|---|---|
| G1 | No Bank simulator (S5) | ✅ Built (held / sent) |
| G2 | No Status page (S6) | ✅ Built in prototype |
| G3 | No Web chat (S7) | ✅ Built in prototype |
| G4 | "New persona", no generate states, no DRAFT/Activate | ✅ Generate button, spinner, error, DRAFT, Activate now |
| G5 | Confidence as 94% / 88% on unverified entities | ✅ LOW / MEDIUM / HIGH words only |
| G6 | No LOAN scam type | ✅ Added |
| G7 | "Signed in · TOTP" | ✅ "Signed in as operator" |
| G8 | Verify row without source link, note, toast | ✅ Evidence panel, excerpt, note, Undo toast |
| G9 | No loading / empty / error states | ✅ In `web/` |
| G10 | Brand "unknown" | ✅ Sockabus logo + wordmark |

### 5.3 Park (M3/M4 vision)
Customer portal (Trends, Webhooks, API keys, Usage), wallet trace, institution webhook feed, Honeypot accounts & Playbooks admin, KPI tiles. Show at most as one roadmap slide.

### 5.4 Sample-data rules
Vanity numbers only if live or labelled "Illustrative". Account holders named "SAMPLE TRADING", never realistic names. No real bank logos. Any API key shown must be `uk_test_…`. Delay copy is **10–30 s** everywhere.

---

## Area 6 — What is already built

### 6.1 Next.js app (`web/`)

Runs at **http://localhost:3000** (Docker `web` container) against the Go API (`app` container, `:8080`). Bring up with `make all` (includes migrations) then `make seed`. Reset local data with `docker compose down -v` — **laptop only, never on the VPS**.

| Path | What |
|---|---|
| `src/app/page.tsx`, `src/app/view.tsx` | Dashboard |
| `src/app/<route>/view.tsx` | One client component per screen |
| `src/app/sign-in/`, `src/app/api/auth/sign-in/route.ts` | Sign-in page and server check |
| `src/proxy.ts` | Next 16 middleware: auth gate for pages and `/api/*`, host-safe redirects |
| `src/app/api/[...path]/route.ts` | Server proxy to the Go API; adds the operator token server-side; blocks `/api/v1/*` |
| `src/app/api/demo/lookup` | Bank lookup → `POST /v1/lookup` |
| `src/lib/store.ts` | Live API actions + polling (3 s; `/readyz` 10 s). `saveDecision` = delayed verify (§4.5) |
| `src/lib/auth.ts` | `next` path validation (single leading `/`, no backslashes, tabs or control characters) |
| `src/lib/seed.ts`, `src/lib/sim.ts` | Sample mode only |
| `src/lib/hooks.ts` | `useQuery` (URL state), flags |

**Settings (`.env.example`)**

| Variable | Effect |
|---|---|
| `SOCKABUS_API_URL` | Go API base URL |
| Operator token (see `.env.example`) | Added by the server proxy; never sent to the browser |
| `SOCKABUS_CONSOLE_USER` / `SOCKABUS_CONSOLE_PASSWORD` | Sign-in credentials (+ a dev flag to turn the gate off) |
| `NEXT_PUBLIC_USE_SAMPLE_DATA=true` | Sample mode: no API calls, data from `seed.ts`, "Sample data — not live" banner on every page. Chosen at build time |
| `NEXT_PUBLIC_DEV_CHAT=false` | Hides Web chat, Reset demo data, Status simulate toggle |
| `NEXT_PUBLIC_UNDO_MS` | Undo window, default `6000`; `0` in CI |

**Live endpoints in use (14):** `GET /internal/personas` · `POST /internal/personas/generate` · `POST /internal/personas/{id}/status` · `GET /internal/accounts` · `GET /internal/conversations` · `GET /internal/conversations/{id}` · `POST …/takeover` (mode human / bot) · `POST …/operator-message` · `GET /internal/entities` · `POST /internal/entities/{id}/verify` · `POST /v1/lookup` (via server route) · `GET /readyz` · `POST /internal/sim/accounts` · `POST /internal/sim/messages`.

**Test IDs added since v1.3:** `api-error`, `result-error`, `verify-retry-btn`, `verify-undo-btn`, `sidebar-toggle-btn`, `signin-user`, `signin-password`, `signin-submit`, `signout-btn`, `persona-modify-btn`, `persona-detail`.

### 6.2 Design references

| Deliverable | Status |
|---|---|
| Figma "Sockabus — v1.0 Frontend" (https://www.figma.com/design/t54DlVhg5BSD2knpktZbRi) | Foundations + S1, S2, S3, S5. Not updated since 28 Oct |
| Prototype "Sockabus Console" (artifact + `front-end/sockabus-console`) | Superseded by `web/` |
| Leader's "Sockabus Console Screens" (30 Oct) | Merged: sign-in, Dashboard layout (two columns, tiles, active chats, persona cards, Summary · today, Verify queue, System), Web chat layout and profile card, Modify, demo path removed. **Changed:** the summary is fixed sentences from real data, not AI-written, and has no Model box (no backend for either). **Not taken:** 6-digit code field and "Lost your authenticator" text (not built), fixed sidebar status text |

### 6.3 Swap to the real API — ✅ done 29–30 Oct

Steps 1–7 of the v1.3 plan are complete, plus the D1 and D3 fixes. Step 8 changed: the sample store is **kept** behind `NEXT_PUBLIC_USE_SAMPLE_DATA` as the demo-day fallback instead of being deleted.

### 6.4 Test results — 30 Oct (headless browser, `e2e.mjs`)

**Latest run (22:14):** live mode **26 / 26**, sample mode **25 / 25**, after the Dashboard and Web chat re-layout. Typecheck and lint pass. Earlier run, same day:

All checks pass in **live mode** (Docker, `SOCKABUS_SIM=1`) and **sample mode**: sign-in gates 5 pages and 4 API routes and stays on the browser's host; wrong login refused; right login returns to the requested page; sign-out; sample banner only in sample mode; generate persona (AI-key message in live); activate; Modify panel survives reload; web chat reply; account captured; take over / send / hand back; list 220 px, chat 900 px; Verify → Undo → 0 rows saved; Verify → bank pre-filled → **Held at High on the first try** (Transfer locked during the save); summary and client panel use only real data; Dashboard numbers match lists; logo → home on 7 pages; sidebar toggle survives reload; entities filters and search; bank Held / Sent; Status green → red (backend stopped) → green; no sideways scroll at 400 px on 10 pages. Redirect checks with `curl`, including `X-Forwarded-Host` (Caddy) and open-redirect attempts (`//evil.com`, `/\evil.com`, `https://evil.com`, tab tricks) all land on this site.

**Notes:** live web chat reply took **54 s** in the test (target 10–30 s, see 6.5). Sample mode ran on the dev server, not Docker (sample mode is a build-time choice).

### 6.5 Open items (not frontend)

| # | Item | Owner |
|---|---|---|
| 1 | Bank holds transfers at **medium** before a human verifies (task 4) — decide: lookup returns no match until verified, or reword copy | Jaxz (+ Jayci for copy) |
| 2 | `GEMINI_API_KEY` on the server, or Generate persona fails in the demo | Jaxz |
| 3 | Live reply took 54 s; check reply-delay settings so the demo stays within 10–30 s | Jaxz |
| 4 | Seed a 10-digit account for "Known loan-scam account" (CIMB accepts only 10 digits), or remove the button | Jaxz / Jayci |
| 5 | Scammer's own handle lands in the Verify queue for every chat | Jaxz |
| 6 | No `/internal/status`: AI errors, lookup speed, Telegram connection, uptime show "Not reported" | Jaxz (after v1.0) |
| 7 | Fake LLM provider + 0 s reply delay for CI | Jaxz |
| 8 | Deploy to VPS (`SOCKABUS_MODE=live`, sign-in credentials set, Caddy HTTPS, Uptime Kuma) | Jaxz |
| 9 | Check: persona Modify — editable or read-only (depends on a backend edit endpoint); Hong Leong (HLB) in the bank list (depends on the validator) | Jayci to confirm |
| 10 | Contract docs: `api/openapi.yaml` missing; TRD endpoint and env names differ from the code (list from 29 Oct CLI report) | Jaxz (after v1.0) |

## Area 7 — Decisions (owner: Jaxz)

| # | Decision | Outcome | Why |
|---|---|---|---|
| D1 | Third lookup result, amber "Check before sending", for unverified accounts? | ❌ **Not doing** (Jaxz, 29 Oct). S5 keeps two results, Held / Sent, as in the PRD. | Keeps v1.0 scope to the PRD and the backend contract unchanged. The demo always verifies before the lookup. Can return in v1.1 if the bank asks how unconfirmed reports are handled. |
| D2 | Show the demo path bar in the real build? | ✅ Closed: **removed entirely** on 30 Oct to match the leader's design. | The presenter follows Andy's demo checklist instead. |
| D3 | Undo after Verify: delay the backend write or write a reversing record? | ✅ **Doing** (Jaxz, 29 Oct): delay the write 6 s on the client. Full spec in §4.5. | `verifications` is append-only (NFR-8); a delayed write keeps the audit trail clean and needs no backend change. |
| D4 | Figma: finish S4/S6/S7 there? | Only if someone gets a Full/Dev seat on a paid or education plan. Otherwise the prototype is the source of truth. | Starter / View seats allow very few AI tool calls per month. |

---

## References

- Sockabus PRD v1.0, TRD v1.0, Blueprint v1.0 (project docs, 26 Oct 2026).
- W3C — Understanding SC 1.4.11 Non-text Contrast (WCAG 2.2): https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html
- WebAIM — Contrast and Color Accessibility: https://webaim.org/articles/contrast/
- Nielsen Norman Group — Trustworthiness in Web Design: 4 Credibility Factors: https://www.nngroup.com/articles/trustworthy-design/
- Rajhans (2026) — Human-Centered Explainability in AI-Enhanced UI Security Interfaces: https://arxiv.org/abs/2601.22653
- Cambridge Intelligence (Nov 2025) — How graph visualization builds trust in human-AI decision workflows: https://cambridge-intelligence.com/how-graph-visualization-builds-trust-in-human-ai-decision-workflows/
- SEON — Explainable AI for Trusted Fraud & Compliance Decisions: https://seon.io/?p=87009
- Figma — MCP server rate limits & access: https://developers.figma.com/docs/figma-mcp-server/rate-limits-access/
