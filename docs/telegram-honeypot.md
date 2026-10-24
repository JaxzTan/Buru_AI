# Telegram honeypot: setup and testing (M1 + M2)

Run a persona on a real Telegram account and chat with it from your own account.

```
your Telegram ──► honeypot account (spare SIM, logged in with tglogin)
                       │ gotd/td (MTProto user account)
                       ▼
              gateway → honeypot service ──► PostgreSQL (encrypted messages, entities)
                       │ SignalWithStart
                       ▼
              Temporal ConversationWorkflow
              read delay ≥ 10 s → "typing…" → Gemini 3.8 Flash → output guard → send
              every message: extraction + stage machine + scam-type classifier
```

## What you need (non-coding)

| # | What | Where |
|---|---|---|
| 1 | A **spare phone number** for the honeypot, with Telegram installed and signed up on a real phone. Use it normally for a few days before connecting it; brand-new numbers logged in from a server are the most likely to be banned. | Any prepaid SIM |
| 2 | A Telegram **api_id / api_hash** | <https://my.telegram.org> → log in with the **honeypot** number → *API development tools* → create an app (any title, platform *Android*) |
| 3 | A **Gemini API key** | <https://aistudio.google.com/apikey> |
| 4 | A **username on the honeypot account** (e.g. `@mei_auntie62`) so you can find it | Telegram → Settings → Username |
| 5 | Your **own** Telegram account to play the scammer | Your phone |

Never commit `.env` or anything in `.secrets/` (both are git-ignored). The session file is a logged-in Telegram account.

## Setup

```sh
cp .env.example .env
make keys                 # paste both lines into .env
# in .env set: GEMINI_API_KEY, BURU_TG_APP_ID, BURU_TG_APP_HASH
# and, while testing, BURU_TG_ONLY_FROM=@your_own_username
make up                   # PostgreSQL, Redis, Temporal (UI on :8233)
make migrate-up           # applies 000001–000004
make seed                 # operator 1, six playbooks, the four console personas (Auntie Mei = persona 1)
make tglogin PHONE=+60XXXXXXXXX PERSONA=1
#   → enter the login code Telegram sends to the honeypot phone (and the 2FA password if set)
#   → binds the account to Auntie Mei in honeypot_accounts
make run                  # BURU_MODE=live; logs "telegram account connected"
```

## No SIM yet? Try Telegram's test network

Telegram runs a separate test network with fake numbers `99966XYYYY` (X = test DC 1-3, YYYY = any digits). The login code is X repeated, 5 or 6 times. **Since 2026 Telegram may refuse random test numbers** (`PHONE_CODE_INVALID`); if both code lengths fail, use a prepaid SIM on the real network instead.

```sh
# in .env
BURU_TG_TEST_DC=2
BURU_TG_ONLY_FROM=            # leave empty on the test network (it is isolated)

make tglogin PHONE=9996620001 PERSONA=1          # the honeypot (Auntie Mei); code 22222 or 222222
make run                                          # terminal 1
make tgchat PHONE=9996620002 TO=9996620001        # terminal 2: you, as the scammer
```

Type in the `tgchat` terminal as the scammer; Auntie Mei's replies and "typing…" appear there. Test accounts are public (anyone can log into the same number) and the network is wiped from time to time: development only. Remove `BURU_TG_TEST_DC` before using a real SIM.

## Test it

1. From **your own** Telegram, open the honeypot's username and send something a scammer would, e.g.
   `Hi Auntie, our USDT plan give 8% weekly, my student already withdraw 3 times`.
2. Expect: your message shows as *read*, then "typing…", then Auntie Mei replies **at least 10 s later**, in her voice.
3. Push toward payment: `Start with 500 USDT, send to TUiNnd7ic6yCmaLmyuE7g7ZF5XYURYLBwR TRC20`. She should stall and ask for another wallet or account.
4. Watch it in the operator API (token from `.env`):

```sh
T="Authorization: Bearer $BURU_OPERATOR_TOKEN"
curl -s -H "$T" localhost:8080/internal/conversations | jq          # stage, scam_type, status
curl -s -H "$T" localhost:8080/internal/conversations/1 | jq        # decrypted messages + entities
curl -s -H "$T" 'localhost:8080/internal/entities?status=unverified' | jq   # verification queue
```

5. Takeover (FR-5): the bot stops at once, even mid-"typing".

```sh
curl -s -H "$T" -X POST -d '{"mode":"human"}' localhost:8080/internal/conversations/1/takeover
curl -s -H "$T" -X POST -d '{"text":"sorry ah my nephew here, wait"}' localhost:8080/internal/conversations/1/operator-message
curl -s -H "$T" -X POST -d '{"mode":"bot"}'   localhost:8080/internal/conversations/1/takeover
```

6. Verify an entity, then look it up (FR-9, FR-10). Before verification the lookup says `medium`; after, `high`.

```sh
curl -s -H "$T" -X POST -d '{"decision":"verified","note":"test"}' localhost:8080/internal/entities/2/verify
curl -s -H "$T" -X POST -d '{"type":"wallet","value":"TUiNnd7ic6yCmaLmyuE7g7ZF5XYURYLBwR","bank":"TRC20"}' localhost:8080/v1/lookup
```

7. Temporal UI at <http://localhost:8233> shows one `ConversationWorkflow` per conversation, with its timers and activities.

## Personas

```sh
# Generate with the persona generator (internal/persona/generator_spec.md); results are drafts.
curl -s -H "$T" -X POST -d '{"count":3,"mode":"random"}' localhost:8080/internal/personas/generate | jq
# Guided:
curl -s -H "$T" -X POST -d '{"count":1,"mode":"guided","guided":{"gender":"male","age_range":"56-70","ethnicity":"Indian","location":"Klang"}}' localhost:8080/internal/personas/generate
# Attach playbooks and activate:
curl -s -H "$T" -X PUT  -d '{"scam_types":["job","loan"]}' localhost:8080/internal/personas/5/playbooks
curl -s -H "$T" -X POST -d '{"status":"active"}'          localhost:8080/internal/personas/5/status
# Edit the prompt (stored as a new version; old versions are kept):
curl -s -H "$T" -X POST -d '{"system_prompt":"You are ..."}' localhost:8080/internal/personas/5/prompt
```

Generated demo identifiers are masked on purpose (MyKad place-of-birth code `00`, which is never issued; `•••` phone and account numbers), so a persona can never hand a scammer a real person's IC or account.

## Operator API (live mode)

All routes need `Authorization: Bearer $BURU_OPERATOR_TOKEN`.

| Method | Path | Does |
|---|---|---|
| GET | `/internal/personas` | List personas with prompt version and playbooks |
| POST | `/internal/personas` | Create a persona (optional `system_prompt`, `scam_types`) |
| POST | `/internal/personas/generate` | Persona generator: `{count, mode, guided}` |
| POST | `/internal/personas/{id}/status` | `draft` / `active` / `paused` / `retired` |
| POST | `/internal/personas/{id}/prompt` | New prompt version |
| PUT | `/internal/personas/{id}/playbooks` | `{scam_types:[...]}` |
| GET | `/internal/playbooks` | Playbooks and stages |
| GET/POST | `/internal/accounts` | List / bind honeypot accounts (bind also connects) |
| POST | `/internal/accounts/{id}/connect` | Connect a bound account |
| POST | `/internal/accounts/{id}/status` | `active` / `banned` / `cooldown` |
| GET | `/internal/conversations[?status=bot\|human\|closed]` | Live chats |
| GET | `/internal/conversations/{id}` | Messages (decrypted) and entities |
| POST | `/internal/conversations/{id}/takeover` | `{"mode":"human"\|"bot"}`; empty body toggles |
| POST | `/internal/conversations/{id}/operator-message` | Send as the persona (after takeover) |
| POST | `/internal/conversations/{id}/close` | Close |
| GET | `/internal/entities[?status=unverified]` | Verification queue |
| POST | `/internal/entities/{id}/verify` | `{"decision":"verified"\|"rejected","note":""}` |
| POST | `/v1/lookup` | TRD §5 lookup (API keys arrive in M3) |

Scammer text comes back as plain JSON strings. The dashboard must render it as text only: no HTML or markdown, no auto-linking, URLs shown defanged (TRD §7).

## Troubleshooting

| Symptom | Fix |
|---|---|
| `telegram account stopped: re-login needed or account banned` | Run `make tglogin` again. If Telegram says the number is banned, set the account to `banned` and use another SIM. |
| Persona never replies | Is the persona `active`? Is your username in `BURU_TG_ONLY_FROM`? Check the Temporal UI for activity errors. |
| Replies are generic playbook lines | `GEMINI_API_KEY` is missing or the call failed; the log says `persona LLM unavailable`. |
| `no session file` on start | The session lives in `BURU_TG_SESSION_DIR`; run `make tglogin` from the same folder you run `make run` from. |
| Messages sent while the app was down are not answered | Known MVP limit: gotd update state is in memory. The persona picks up the next message. |

## Tests

```sh
make test       # unit tests, including Temporal workflow tests (timing floor, takeover, bursts)
make test-e2e   # full loop on local PostgreSQL + Temporal with a fake Telegram sender and LLM
```
