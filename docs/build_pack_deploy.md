
---

# BP-DEPLOY — DigitalOcean App Platform (MVP)

**Owner:** DevOps
**Depends on:** MasterSpec-v1.0, BP-API.md, BP-WORKER.md, BP-DB.md
**Goal:** Deploy two services on **DigitalOcean App Platform** (UI/API + Worker), configure env/secrets, health checks, CORS, and a minimal CI flow. Provide repeatable smoke tests.

---

## 1) Topology (App Platform)

One App with two services:

* **api** (Node/Express — serves `/api/*` and static `/dashboard`)

  * Exposes HTTPS to the internet.
  * Has the session cookie + Google OAuth flow.
* **worker** (Node service — Baileys + ingest)

  * **No public URL** (internal-only), just health check.
  * Reads/writes Supabase (DB + Storage).

```
DO App
 ├─ Service: api     (public) → /api/*, /, /dashboard
 └─ Service: worker  (internal) → /healthz only
Supabase (managed)
```

---

## 2) Repo Layout (reference)

```
repo/
  apps/
    api/        # Express API + static dashboard hosting
    worker/     # Baileys + ingest
  docs/
    MasterSpec-v1.0.md
    BP-*.md
  db/
    migrations/
      0001_init.sql
      0002_seed.sql
  app.yaml      # DO App Platform spec (below)
```

---

## 3) `app.yaml` (App Platform Spec)

> Place this at repo root. Update Git branch names as needed.

```yaml
name: wa-monitor
region: fra
services:
  - name: api
    git:
      repo_clone_url: https://github.com/your-org/wa-monitor.git
      branch: main
      deploy_on_push: true
    env: NODE_JS
    build_command: |
      cd apps/api && npm ci && npm run build
    run_command: |
      node dist/index.js
    http_port: 3000
    instance_count: 1
    instance_size_slug: basic-xxs   # bump to xs if needed
    routes:
      - path: /
      - path: /dashboard
      - path: /api
    health_check:
      http_path: /healthz
      initial_delay_seconds: 10
      period_seconds: 10
      timeout_seconds: 3
      success_threshold: 1
      failure_threshold: 3
    envs:
      # Supabase
      - key: SUPABASE_URL
        scope: RUN_AND_BUILD_TIME
        value: https://YOUR-PROJECT.supabase.co
      - key: SUPABASE_SERVICE_KEY
        scope: RUN_AND_BUILD_TIME
        type: SECRET
        value: ${SUPABASE_SERVICE_KEY}
      # Auth
      - key: GOOGLE_CLIENT_ID
        value: ${GOOGLE_CLIENT_ID}
        type: SECRET
      - key: GOOGLE_CLIENT_SECRET
        value: ${GOOGLE_CLIENT_SECRET}
        type: SECRET
      - key: ENCRYPTION_KEY            # 32-byte base64 for AES-GCM
        value: ${ENCRYPTION_KEY}
        type: SECRET
      # App
      - key: NODE_ENV
        value: production
      - key: SIGNED_URL_TTL_DAYS
        value: "7"
      - key: LOG_LEVEL
        value: info
      # CORS origin (UI/API domain)
      - key: APP_ORIGIN
        value: https://wa.example.com

  - name: worker
    git:
      repo_clone_url: https://github.com/your-org/wa-monitor.git
      branch: main
      deploy_on_push: true
    env: NODE_JS
    build_command: |
      cd apps/worker && npm ci && npm run build
    run_command: |
      node dist/index.js
    http_port: 3001
    instance_count: 1
    instance_size_slug: basic-xxs   # bump if ingest heavy
    health_check:
      http_path: /healthz
      initial_delay_seconds: 15
      period_seconds: 10
      timeout_seconds: 3
      success_threshold: 1
      failure_threshold: 3
    envs:
      - key: SUPABASE_URL
        scope: RUN_AND_BUILD_TIME
        value: https://YOUR-PROJECT.supabase.co
      - key: SUPABASE_SERVICE_KEY
        scope: RUN_AND_BUILD_TIME
        type: SECRET
        value: ${SUPABASE_SERVICE_KEY}
      - key: NODE_ENV
        value: production
      - key: LOG_LEVEL
        value: info
      - key: WORKER_POLL_MS
        value: "2000"
      - key: WORKER_MAX_MEDIA_MB
        value: "25"
      - key: WORKER_BACKOFF_BASE_MS
        value: "1000"
      - key: WORKER_BACKOFF_MAX_MS
        value: "30000"
```

> Replace `${…}` with DO App Platform config variables (Secrets).
> `region` pick closest to Supabase project region to reduce latency.

---

## 4) DNS / Domains / SSL

* Create a subdomain (e.g., `wa.example.com`) in DO Networking, point to the App.
* App Platform auto-issues **Let’s Encrypt** SSL.
* Ensure Google OAuth callback uses this exact origin.

**OAuth Redirect URIs (Google Console):**

* `https://wa.example.com/auth/callback`
* Add local dev URI if needed: `http://localhost:3000/auth/callback`

---

## 5) Environment Variables (recap)

### API service

* `SUPABASE_URL` — e.g., `https://<proj>.supabase.co`
* `SUPABASE_SERVICE_KEY` — service role key (**secret**)
* `GOOGLE_CLIENT_ID` (**secret**)
* `GOOGLE_CLIENT_SECRET` (**secret**)
* `ENCRYPTION_KEY` — 32-byte base64 (**secret**)
* `SIGNED_URL_TTL_DAYS` — default `7`
* `APP_ORIGIN` — `https://wa.example.com`
* `NODE_ENV=production`
* `LOG_LEVEL=info`

### Worker service

* `SUPABASE_URL`
* `SUPABASE_SERVICE_KEY` (**secret**)
* `WORKER_POLL_MS=2000`
* `WORKER_MAX_MEDIA_MB=25`
* `WORKER_BACKOFF_BASE_MS=1000`
* `WORKER_BACKOFF_MAX_MS=30000`
* `NODE_ENV=production`
* `LOG_LEVEL=info`

---

## 6) CORS, Cookies, and Security

* **CORS:** Set `Access-Control-Allow-Origin: APP_ORIGIN` (not `*`).
* **Cookies:** Set `httpOnly`, `secure`, `sameSite=strict`.
* **Headers:** Add `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`.
* **Rate limiting (light):**

  * `/api/wa/refresh-qr` → 1 per 3s (429 otherwise)
  * `/api/fetch-groups-now` → 1 per 10s
* **No public bucket:** `wa-media` is private; only server generates signed URLs.

---

## 7) Build & Run Commands (reference)

### API (`apps/api`)

* `npm ci && npm run build` → produces `dist/`
* `node dist/index.js` (listens on `$PORT` = 3000)

### Worker (`apps/worker`)

* `npm ci && npm run build`
* `node dist/index.js` (listens on `$PORT` = 3001 for `/healthz`)

> Ensure both read `$PORT` from env (App Platform sets it) or bind explicitly to the `http_port` above.

---

## 8) Initial Supabase Setup (once)

1. Create project in Supabase UI.
2. Run migrations:

   * Upload and run `db/migrations/0001_init.sql` and `0002_seed.sql` via SQL editor or CI.
3. Create **private** bucket:

   ```sql
   insert into storage.buckets (id,name,public)
   values ('wa-media','wa-media',false)
   on conflict (id) do nothing;
   ```
4. Generate a **service role key**; put it in DO App secrets.

---

## 9) CI/CD (minimal)

Use DO’s “Deploy on Push” in `app.yaml`.
Optionally add GitHub Actions for lint/build/tests before push, e.g.:

```yaml
# .github/workflows/ci.yml
name: ci
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        app: [api, worker]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '18' }
      - run: cd apps/${{ matrix.app }} && npm ci && npm run build && npm test --if-present
```

---

## 10) Post-Deploy Smoke Tests

Run from your laptop (replace domain):

```bash
# 1. Health
curl -s https://wa.example.com/healthz

# 2. Auth guard (should 401 if no cookie)
curl -i https://wa.example.com/api/status

# 3. After logging in via browser (cookie stored), test:
# Replace COOKIE.txt with your exported cookie jar (or use browser)
curl -s --cookie "session=..." https://wa.example.com/api/status | jq

# 4. Trigger discovery (throttled)
curl -s --cookie "session=..." -X POST https://wa.example.com/api/fetch-groups-now

# 5. List groups
curl -s --cookie "session=..." "https://wa.example.com/api/groups?limit=5" | jq

# 6. Messages page
curl -s --cookie "session=..." "https://wa.example.com/api/messages?limit=5" | jq

# 7. Worker health (internal; check logs via DO dashboard)
# (No public URL; verify Service → Logs show "GET /healthz 200")
```

---

## 11) Scaling & Costs (MVP)

* Start both services at `basic-xxs` (512MB).
* If media spikes:

  * Move **worker** to `basic-xs` (1GB).
  * Keep **api** at `xxs` unless heavy traffic.
* Consider auto-scale later; not needed for MVP.

---

## 12) Logging & Observability

* App Platform provides aggregated logs per service.
* Ensure each request logs `x-request-id`.
* Worker logs events as well as DB `audit_log` entries.
* For simple metrics, add `/metrics` JSON (optional) or rely on activity panel + logs.

---

## 13) Rollback

* App Platform keeps deploy history.
* To rollback: “Revert to previous deployment” in DO UI.
* DB migrations: prefer forward-only; avoid destructive down-migrations in prod.

---

## 14) Acceptance Criteria (Deploy)

* [ ] Both services show **green** and pass health checks.
* [ ] Domain `https://wa.example.com` serves the login page with SSL.
* [ ] After Google login, `/dashboard` loads and polls `/api/status`.
* [ ] Worker connects after QR scan; status flips to `connected`.
* [ ] `fetch-groups-now` works; toggles persist; messages ingest within a monitored group.
* [ ] Media opens via signed URL; expires after TTL.
* [ ] Logs show request IDs; activity panel reflects key events.

---

**End of BP-DEPLOY.md**

---
