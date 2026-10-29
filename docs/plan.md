# Plan: Docker production setup (TR-23 / NFR-11)

Goal: the full Compose stack runs 24/7 on one VPS, deployed from `main` with one command, before the bank demo on **2 Nov 2026**.

Source: [TRD.md](TRD.md) §3 Hosting, §6 TR-20/TR-21/TR-23, §8; [PRD.md](PRD.md) NFR-11; [docker.md](docker.md).

Status (29 Oct 2026): local stack done. Phase 1 and Phase 3 files written and config-validated; local boot test of the full prod stack in progress. Phase 2 (VPS) not started. Production about 55%.

Legend: `[x]` done and verified, `[~]` written, not yet verified end to end, `[ ]` not started.

## Done

- [x] PostgreSQL 16, Redis 7.4, Temporal dev server in `docker-compose.yml`
- [x] Go API image (`Dockerfile`, distroless, non-root)
- [x] Next.js dashboard image (`web/Dockerfile`, standalone)
- [x] `.dockerignore` keeps `.env` out of images
- [x] CI builds the Go image (`.github/workflows/ci.yml`)

## Phase 1: Compose stack ready for prod (about 3 hr)

- [~] 1. `Caddyfile` + `caddy` service: HTTPS for `BURU_DOMAIN`; `/v1/*`, `/healthz`, `/readyz` to `app:8080`, everything else to `web:3000` (web already proxies `/api/*`). `caddy validate` passes
- [~] 2. `uptime-kuma` service (`louislam/uptime-kuma:1.23.16`), volume `uptime-kuma-data`, UI on `127.0.0.1:3001` only
- [~] 3. Temporal persists: dev server with `--db-filename` on the `temporal-data` volume (mounted at `/home/temporal`, owned by the image's uid 1000)
- [x] 4. `docker-compose.prod.yml` overlay: no public ports except Caddy, `restart: unless-stopped`, Telegram sessions mounted at `/secrets/telegram`. `docker compose config` passes; missing `BURU_DOMAIN` fails fast
- [x] 5. `make down` now runs `docker compose --profile app down`
- [x] Extra: `POSTGRES_PASSWORD` env var (default `buru` locally); `migrate` service so the VPS needs no Go tools

Done when: the prod stack boots locally with `BURU_DOMAIN=localhost` and serves the dashboard and `/healthz` through Caddy. **Pending:** image build running.

## Phase 2: Server (about 2 hr)

- [ ] 6. Rent a VPS (SG/MY region), install Docker, open only ports 22, 80, 443 (1 hr)
- [ ] 7. Point a domain or subdomain at the VPS IP (15 min, plus DNS wait time)
- [ ] 8. Create `.env` on the server only: `BURU_MODE=live`, `BURU_DOMAIN`, `POSTGRES_PASSWORD`, fresh `make keys` values, the live LLM key (15 min)
- [ ] 9. Copy `.secrets/telegram/` to the server, then `sudo chown -R 65532:65532 .secrets/telegram` (15 min)

Steps: [docker.md](docker.md) → Production → First-time server setup.

Done when: `https://<domain>/api/healthz` returns 200 from the VPS.

## Phase 3: Deploy and backups (about 2 hr)

- [~] 10. `make deploy`: `git pull --ff-only origin main`, start postgres/redis, `run --rm migrate`, `up -d --build`. Plus `make prod-ps`, `make prod-logs`
- [~] 11. `make backup` (`scripts/backup.sh`): gzip `pg_dump` into `backups/`, 14-day retention, rclone copy when `BACKUP_REMOTE` is set. Still to do on the VPS: add the cron line, pick off-server storage (15 min)
- [~] 12. `make restore-test` (`scripts/restore-test.sh`): restores the newest dump into a scratch DB, counts rows, drops it. Run once on the VPS

Done when: one `make deploy` runs a fresh commit on the server with no manual steps.

## Phase 4: Monitoring (TR-20, about 1 hr)

- [ ] 13. Uptime Kuma HTTP checks on `/healthz` and `/readyz`
- [ ] 14. Push heartbeat from the Telegram connector
- [ ] 15. Alerts to the team Telegram group, test one by stopping `app`

Done when: stopping `app` triggers an alert within 2 minutes.

## Later (after v1.0)

- [ ] CI runs the Compose stack and Playwright API/UI tests (TR-21)
- [ ] CI builds the `web` image
- [ ] Staging environment and Temporal Cloud (TRD §8)

## Demo exit checks (TRD §13)

- [ ] Full demo rehearsed on the deployed server, run 1
- [ ] Full demo rehearsed on the deployed server, run 2
