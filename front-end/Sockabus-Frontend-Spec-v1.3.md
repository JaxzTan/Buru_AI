# Sockabus v1.0 — Frontend Spec

| Field | Value |
|---|---|
| Prepared for | Frontend lead, Sockabus (formerly Buru AI) |
| Based on | PRD v1.0, TRD v1.0, Blueprint v1.0 (26 Oct 2026), "Unknown Figma.pdf", Sockabus bunting |
| Version | 1.3 |
| Last updated | 29 Oct 2026 |
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

> **Status at 29 Oct:** all 7 screens run in the Next.js app on **sample data in the browser**. Nothing calls the Go API yet. The two fixes from the closed decisions are done (amber bank result removed for D1, delayed Undo added for D3; Area 6.3). The next job is the swap to the real API.

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
| F18 | Demo path bar (step tracker + one "Next" button) | — | All (demo build only) | Nice-to-have | Keeps the presenter on script. Hide behind the same flag as web chat. |
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
| S1 Personas | `/personas` | `?status=all\|active\|draft\|paused&new=<personaId>` |
| S2 Conversations | `/conversations/[id]` | `?status=all\|bot\|operator\|closed` |
| S3 Verify | `/verify` | `?selected=<entityId>` |
| S4 Entities | `/entities` | `?type=…&status=…&q=…` |
| S5 Bank simulator | `/demo/bank` | none |
| S6 Status | `/status` | none |
| S7 Web chat | `/demo/chat` | `?persona=<personaId>` |

`/` redirects to `/personas`. ✅ Implemented in `web/` via `useQuery` in `src/lib/hooks.ts`.

**Implementation (Next.js App Router):** selected item in the path segment (`/conversations/[id]`); filters via `useSearchParams` + `router.replace()` (replace, not push, so Back doesn't step through every filter click).

**Never in the URL:** account numbers, wallet addresses, phone numbers, message text, tokens. URLs end up in browser history, logs and screenshots (PRD NFR-4). This is why S5 has no query state, and why S4 search `q` should be cleared before sharing a link in a public deck.

### 4.3 Screens

**Legend:** 🟢 REAL (live backend) · 🟡 REAL CALL, FAKE CONTEXT (e.g. pretend bank) · 🔴 SEED (fixed sample data, labelled SAMPLE, never real people)

**Global (all screens)**

| Part | Content | Real/fake | Notes |
|---|---|---|---|
| Sidebar (navy) | Logo + wordmark; Operate: Personas, Conversations (live count), Verify queue (pending count), Entities, Status; Demo: Bank simulator, Web chat; mini status card; "Signed in as operator" | 🟢 counts | Web chat only when `NEXT_PUBLIC_DEV_CHAT=true`. **No "TOTP"** — not built (G-7) |
| Mobile | Sidebar becomes a top bar with a horizontally scrolling nav | — | No horizontal page scroll at 400 px |
| States | Spinner on long actions, empty state with the next action, error with retry | — | Blueprint §11 |

**S1 — Personas `/personas`**

| Screen part | Content | Sample data | Real/fake |
|---|---|---|---|
| Header + **+ Generate persona** (mustard) | Spinner "Generating… up to 30 s" while busy | — | 🟢 |
| "Persona ready" banner | Name, age, place, backstory, wealth band, languages, honeypot handle; **Generate another** / **Activate now** | "Mei Ling, 62 · Penang · retired clerk · RM100k–300k" | 🟢 LLM-generated |
| After activate | Green banner "Mei Ling is live on @meiling62" + **Chat as scammer →** (demo build) | — | 🟢 |
| Filter tabs | All / Active / Draft / Paused with counts | — | 🟢 |
| Table | Name (initials avatar), languages (chips), status, honeypot handle, created, Activate / Pause | 3–4 rows | 🟢 |
| Error banner | "Couldn't generate a persona… nothing was saved" + Try again | — | 🟢 |
| Footer note | "Generated personas never use real people's names, IDs or photos" | — | — |

**S2 — Conversations `/conversations/[id]`**

| Screen part | Content | Sample data | Real/fake |
|---|---|---|---|
| Live pill | "LIVE · updated 2 s ago" (3 s poll) | — | 🟢 |
| Left list + filter tabs | Scammer handle → persona, last message preview, time, scam chip, status badge | "@hr_parttime_job → Mei Ling · JOB · BOT" | 🟢 |
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
| "Why the system flagged this" | ✓ sent by scammer · ✓/! sent during payment-request stage · ✓ valid format for that bank/chain · ✓/! sightings count | — | 🟢 |
| Source excerpt | 2 messages, the value highlighted in red mono; "Open full chat →" | — | 🟢 |
| Note + actions | Optional note; "After you verify: confidence becomes high…"; **Reject (R)** / **Verify (V)** | — | 🟢 |
| Toast | "Verified … — now high · Undo". The API call waits until the toast closes (§4.5) | — | 🟢 |
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
| Quick fill | Account captured from chat · Known loan-scam account · Clean account | — | 🟡 |
| **Transfer RM x** | Spinner "Checking recipient with Sockabus…"; validation if < 10 digits | — | 🟡 |
| Result — **held** (red) | "Transfer held", scam type, confidence High · human-verified, seen N times, first seen, checked in N ms; Edit recipient / Cancel transfer | — | 🟢 real `/v1/lookup` |
| Result — **sent** (green) | "Transfer sent — no scam record. Checked in 18 ms" | — | 🟢 |
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
| Simulate toggle | "Simulate: Telegram drops / reconnect" | — | **Prototype only — remove in production** |

**S7 — Web chat `/demo/chat`**

| Screen part | Content | Sample data | Real/fake |
|---|---|---|---|
| Header | "Talking to" persona picker (active only) | "Mei Ling (active)" | 🟢 |
| Chat | Messenger look: scammer = you (navy, right), persona (white, left), typing indicator | Golden script | 🟢 real gateway |
| Golden script buttons | 1 Opener · 2 Deposit ask · 3 Send account · 4 Push urgency (fill the box; used ones tick off) | — | — |
| Composer | Input + Send | — | 🟢 |
| Helper panel | When to use this page; go/no-go Fri 30 Oct 12:00 | — | — |
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
| G9 | No loading / empty / error states | ✅ In prototype; add to Figma when the seat allows |
| G10 | Brand "unknown" | ✅ Sockabus logo + wordmark |

### 5.3 Park (M3/M4 vision)
Customer portal (Trends, Webhooks, API keys, Usage), wallet trace, institution webhook feed, Honeypot accounts & Playbooks admin, KPI tiles. Show at most as one roadmap slide.

### 5.4 Sample-data rules
Vanity numbers only if live or labelled "Illustrative". Account holders named "SAMPLE TRADING", never realistic names. No real bank logos. Any API key shown must be `uk_test_…`. Delay copy is **10–30 s** everywhere.

---

## Area 6 — What is already built

### 6.1 Next.js app (`web/`) — the real frontend from 28 Oct

The Sockabus Console prototype is rebuilt as Next.js pages in `web/`. It replaces the "unknown" dashboard. Run it with `cd web && pnpm dev`. Next.js forwards `/api/*` to the Go API (`BURU_API_URL`, default `http://localhost:8080`).

| Path | What |
|---|---|
| `src/app/<route>/view.tsx` | One client component per screen |
| `src/components/` | Shell (sidebar, demo path, toasts), shared atoms, chat pieces |
| `src/lib/store.ts` | Demo data and **every action** (generate, verify, lookup…). Each action is one swap point for the Go API |
| `src/lib/sim.ts` | Stand-ins for backend work: extraction, classification, persona replies, lookup rules |
| `src/lib/seed.ts` | Sample data and the golden script |
| `src/lib/hooks.ts` | `useQuery` (URL state), `DEV_CHAT` flag |
| `src/app/globals.css` | The prototype's `styles.css` (Tailwind removed) |
| `src/app/fonts/` | Archivo, Archivo Black, JetBrains Mono, self-hosted (no Google Fonts fetch at build) |

**Flag:** `NEXT_PUBLIC_DEV_CHAT=false` hides Web chat, the demo path bar, the "Reset demo data" button and the Status "Simulate" toggle. Unset = shown.

**Removed:** `/operator/*` and `/portal/*` pages (customer portal is not v1.0, Area 5.3). Earlier (23 Oct) the Go-embedded static HTML pages (`/console`, `/portal`, `internal/server/pages*`) were removed; the Go server is API only and `GET /`, `/console`, `/portal` on `:8080` return 404.

**Not yet true:** data is still sample data in `localStorage`. No screen calls the Go API.

### 6.2 Design references

| Deliverable | Where | Status |
|---|---|---|
| Figma "Sockabus — v1.0 Frontend" | https://www.figma.com/design/t54DlVhg5BSD2knpktZbRi | Foundations, S1, S2, S3, S5 held/sent. S4, S6, S7 not in Figma (Starter plan AI tool-call limit). The Next.js app is now the source of truth |
| Prototype "Sockabus Console" | Published artifact + `front-end/sockabus-console` | Reference only; superseded by `web/` |

### 6.3 Next: swap sample data for the real API

**First, two small fixes from the closed decisions (✅ done 29 Oct):**

| Fix | Where | Change |
|---|---|---|
| D1 — remove amber result | `src/lib/sim.ts` lookup rules, `src/app/demo/bank/view.tsx` | Delete the `warn` branch and the `result-warn` block. Lookup returns Held for `match: true`, Sent for `match: false`. Held banner shows the confidence it receives |
| D3 — delayed Undo | `src/lib/store.ts` (`decide` action, `saveDecision` swap point, `flushDecisions`), toast in `src/components/Shell.tsx` | Pending-decision timers per entity, Undo cancels, flush on route change and `pagehide`, `NEXT_PUBLIC_UNDO_MS` (§4.5). Add `data-testid="verify-undo-btn"` to the Undo button |

Then do one action at a time in `src/lib/store.ts`, test it, then move on. Order follows the demo path.

| # | Store action / stand-in | Real call | Test cases |
|---|---|---|---|
| 1 | Personas list, generate, activate/pause | `GET /internal/personas` · `POST /internal/personas/generate` · `PATCH /internal/personas/{id}/status` | TC-1, TC-4, TC-5 |
| 2 | Web chat send (`sim` persona replies, extraction, classification) | `POST /internal/dev/inject`; replies via `GET /internal/conversations/{id}/messages`. **Delete** extraction/classification/reply stand-ins from `sim.ts` (backend does them) | TC-6, TC-7, TC-11 |
| 3 | Conversations list, messages, takeover, operator send | `GET /internal/conversations` · `GET …/{id}/messages` (poll 3 s) · `POST …/takeover` · `POST …/messages` | TC-9, TC-10 |
| 4 | Verify / reject | `POST /internal/entities/{id}/verify`, sent when the Undo timer ends (§4.5) | TC-14, TC-15 + Undo test |
| 5 | Entities list | `GET /internal/entities?type=&status=` | — |
| 6 | Bank lookup (`sim` lookup rules) | Next.js server route `/api/demo/lookup` → `POST /v1/lookup`, token server-side only. Two results: Held / Sent | TC-16, TC-17, TC-19 |
| 7 | Status tiles | `GET /internal/status` (poll 10 s) | TC-21 |
| 8 | Remove `localStorage` state and `seed.ts` from the production path | Keep seed only for the mock / tests | — |

Before each swap: check the field names against `api/openapi.yaml` and run it against the Prism mock first (`npx @stoplight/prism-cli mock api/openapi.yaml`). Error format from the API is `{ "error": { "code", "message" } }`; show `message` in the screen's error state.

## Area 7 — Decisions (owner: Jaxz)

| # | Decision | Outcome | Why |
|---|---|---|---|
| D1 | Third lookup result, amber "Check before sending", for unverified accounts? | ❌ **Not doing** (Jaxz, 29 Oct). S5 keeps two results, Held / Sent, as in the PRD. | Keeps v1.0 scope to the PRD and the backend contract unchanged. The demo always verifies before the lookup. Can return in v1.1 if the bank asks how unconfirmed reports are handled. |
| D2 | Show the demo path bar in the real build? | ✅ Done: hidden when `NEXT_PUBLIC_DEV_CHAT=false`. | Helps the presenter; a bank's analysts don't need it. |
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
