# tableai-kind01 — KiND Dual-Role Platform

Mobile-first prototype: **Experts** train digital twins and publish to marketplace; **Seekers** post briefs, hire experts, and receive reviews.

Backend API uses **SQLite as the primary database** and can **sync to PostgreSQL** when `POSTGRES_URL` is set.

## Database (SQLite + PostgreSQL)

| Layer | Role |
|-------|------|
| **SQLite** (`data/kind.sqlite`) | Primary — all API reads/writes |
| **PostgreSQL** | Optional replica via sync |

```bash
cd server && npm install
cp env.sample .env   # set POSTGRES_URL if you use Postgres
npm run db:migrate
npm run db:seed
npm run dev          # API on http://127.0.0.1:8788
npm run db:sync      # push SQLite → Postgres (needs POSTGRES_URL)
```

- `POST /api/sync` — manual sync
- `SYNC_ON_WRITE=1` — sync after each write
- `GET /api/sync/status` — last sync time / errors

## Run prototype (static)

```bash
./scripts/dev-up.sh              # start on 8787
./scripts/dev-up.sh status         # port / PID / listeners
./scripts/dev-up.sh stop           # kill only this repo's python http.server
AUTO_PORT=1 ./scripts/dev-up.sh    # pick next free port if 8787 is taken
PORT=8790 ./scripts/dev-up.sh      # fixed alternate port
```

Opens http://127.0.0.1:8787/kind-dual-role.html by default.

The script checks `lsof` for listeners, stops **only** prior KiND servers (same repo + `python3 -m http.server`), and refuses to hijack unrelated processes on your chosen port unless `AUTO_PORT=1`.

**Use the dev server** — do not open the HTML file directly (`file://`), or Tailwind/fonts may fail to load.

## MVP flows

| Role | Screens |
|------|---------|
| Expert | Hub → Train → Inbox → Vault (+ Publish to Vault) |
| Seeker | Market → Brief → Requests → Expert detail → Checkout → Review |

Toggle **EN / 中文** (top right). Preference saved in `localStorage`.

## Docker (AMD64 / Linux servers)

Images target **`linux/amd64`** for typical AMD cloud VMs.

```bash
# Full stack: Postgres + API + nginx (H5 + /api proxy)
docker compose up -d --build
# App: http://localhost:8080/kind-dual-role.html

# API-only (SQLite volume, no Postgres)
docker compose -f docker-compose.api-only.yml up -d --build

# Explicit amd64 build (e.g. from Mac ARM)
chmod +x scripts/docker-build-amd64.sh
./scripts/docker-build-amd64.sh
```

| Service | Port | Notes |
|---------|------|--------|
| `web` | 8080 | Static prototype; proxies `/api` → `api` |
| `api` | 8788 (internal) | SQLite volume `/app/data` |
| `postgres` | 5432 (internal) | Optional sync target |

Env: `WEB_PORT`, `SYNC_ON_WRITE`, `KIND_RUN_SEED` (default seed on first deploy).

## Tests

```bash
cd server && npm test
```

CI runs tests and `linux/amd64` Docker builds on every PR.

## Files

- `kind-dual-role.html` — full app (single file)
- `server/` — Fastify API, Drizzle ORM, SQLite + Postgres sync
- `docker-compose.yml` — production-style stack (amd64)
- `stitch_expert_twin_marketplace/` — Stitch reference screens
- `scripts/dev-up.sh` — port check, kill previous KiND server, start `python3 -m http.server`
- `scripts/docker-build-amd64.sh` — build amd64 images
