# Sockabus Console — v1.0 prototype

Clickable prototype of the 7 v1.0 screens (Personas, Conversations, Verify queue, Entities, Status, Bank simulator, Web chat). All data is fictitious and lives in the browser.

## Files
| File | What it holds |
|---|---|
| `index.html` | Page shell: sidebar, address bar, demo-path bar, `<main>` that each screen renders into |
| `styles.css` | Design tokens (colours, fonts) at the top, then shell, shared atoms (buttons, badges, chips), one block per screen, mobile rules |
| `app.js` | Seed data, state (saved to `localStorage`), hash routing (`#personas`, `#verify`, …), one `v<Screen>()` view function per screen, user actions |
| `assets/logo.png` | Mascot logo |

## Run it
Open `index.html` in a browser, or serve the folder: `npx serve .` then visit the URL it prints.

## Notes for the Next.js build
- Routes: hash names here map to real routes (`/personas`, `/conversations/[id]`, `/verify`, `/entities`, `/status`, `/demo/bank`, `/demo/chat`). Keep selections and filters in the URL query (`useSearchParams` + `router.replace`) so reload stays on the same view. Never put account numbers in the URL.
- Each `v<Screen>()` function in `app.js` is one page component. `data-testid` names follow Blueprint §5.
- Simulated parts to replace with API calls: `ACT.generate` → `POST /internal/personas/generate`, `scammerSends` → `POST /internal/dev/inject`, `decide` → `POST /internal/entities/{id}/verify`, `lookup` → Next.js route `/api/demo/lookup` → `POST /v1/lookup`.
- "Reset demo data" in the sidebar restores the seed.
