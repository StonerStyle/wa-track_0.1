
---

# BP-API — Express Backend Build Pack (MVP)

**Owner:** Backend (API service)
**Depends on:** MasterSpec-v1.0 (§ API Contracts, Error Handling)
**Goal:** Implement the API endpoints for dashboard and worker communication. All routes must follow the **contracts + error model** from the Master Spec.

---

## 1) Scope

Implement the following **public API routes** (all under `/api`):

* **Auth**

  * `POST /api/logout`
* **Status & QR**

  * `GET /api/status`
  * `GET /api/qr`
  * `POST /api/wa/refresh-qr`
  * `POST /api/wa/disconnect`
* **Groups**

  * `GET /api/groups`
  * `POST /api/groups/:id/toggle`
  * `POST /api/fetch-groups-now`
* **Messages**

  * `GET /api/messages`
* **Activity**

  * `GET /api/activity`

---

## 2) Tech & Structure

* **Express.js** (Node 18+).
* `zod` (or equivalent) for request validation.
* Middleware:

  * Auth check (session cookie).
  * Request ID + logging.
  * Error handler (map to standard JSON error model).

Suggested structure:

```
apps/api/
  src/
    index.ts          # app entry
    routes/
      status.ts
      qr.ts
      groups.ts
      messages.ts
      activity.ts
      auth.ts
    middleware/
      auth.ts
      error.ts
      requestId.ts
    lib/
      supabase.ts
      sessions.ts
    types/
      api.d.ts
```

---

## 3) Request / Response Contracts

Follow **MasterSpec-v1.0** API Contracts exactly.
Uniform error model:

```json
{ "error": "short_code", "message": "Human readable message" }
```

* **401** → `unauthorized`
* **400** → `bad_request`
* **404** → `not_found`
* **409** → `conflict` (e.g., QR requested while connected, toggle no-change)
* **429** → `too_many_requests`
* **500** → `server_error`

---

## 4) Endpoints (Implementation Details)

### Auth

* **POST /api/logout**

  * Clear cookie/session.
  * Always return `{ok:true}` (even if already logged out).

### Status

* **GET /api/status**

  * Read from DB/session tables: Google + WA session.
  * Return state + user info.

### QR

* **GET /api/qr**

  * If WA `connected` → return `{}`.
  * Else → return `{qr, expiresAt}` from session store.
* **POST /api/wa/refresh-qr**

  * Flip runtime flag for worker.
  * Return 202 `{ok:true}`.
  * Guard: if connected → 409.
  * Guard: min interval 3s → 429.
* **POST /api/wa/disconnect**

  * Set flag for worker to drop session.
  * Always 202 `{ok:true}`.

### Groups

* **GET /api/groups?search\&limit\&offset**

  * Query Supabase `groups` table.
  * Apply `ILIKE` search on `name` and `wa_group_id`.
  * Return total + items.
* **POST /api/groups/\:id/toggle**

  * Body: `{monitor: true|false}`.
  * Update DB.
  * If no change → 409 `{error:"no_change"}`.
* **POST /api/fetch-groups-now**

  * Set runtime flag for worker.
  * Throttle: 1 call / 10s → 429.
  * Return `{ok:true}`.

### Messages

* **GET /api/messages?limit\&offset\&groupId\&kind**

  * Query `messages` with filters.
  * Join `groups` (name) and `media` (signed URL).
  * Return paginated list.

### Activity

* **GET /api/activity?limit**

  * Query latest from `audit_log`.
  * Order by `at desc`.
  * Return items (default 50).

---

## 5) Middleware

* **Auth middleware**

  * Check signed cookie.
  * On missing/invalid → 401.
* **Error handler**

  * Catch thrown errors → map to error model.
  * Log request-id, stack trace.
* **Request ID middleware**

  * Generate uuid v4 per request.
  * Attach to logs + response header `x-request-id`.

---

## 6) Security

* No Supabase keys in client.
* All queries via service role key inside API.
* CORS: restrict to app domain.
* Cookies: `httpOnly`, `secure`, `sameSite=strict`.

---

## 7) Tasks (checklist)

* [ ] Scaffold Express app with middleware (auth, error, req-id).
* [ ] Implement `/api/logout`.
* [ ] Implement `/api/status`.
* [ ] Implement `/api/qr`.
* [ ] Implement `/api/wa/refresh-qr`.
* [ ] Implement `/api/wa/disconnect`.
* [ ] Implement `/api/groups` (GET).
* [ ] Implement `/api/groups/:id/toggle`.
* [ ] Implement `/api/fetch-groups-now`.
* [ ] Implement `/api/messages`.
* [ ] Implement `/api/activity`.
* [ ] Add unit tests for each route (happy + error paths).
* [ ] Add HTTPie/Postman scripts to `/scripts/api/`.

---

## 8) Acceptance Criteria

* [ ] All endpoints return JSON, correct schema.
* [ ] Error codes match contract (401/400/404/409/429/500).
* [ ] 401 → redirects user to login in UI.
* [ ] Toggle persists in DB and survives reload.
* [ ] Fetch new groups triggers worker, doesn’t reset toggles.
* [ ] Messages API includes valid signed URLs (expire after 7d).
* [ ] Activity API returns audit rows in desc order.
* [ ] Logs contain request-id + error details.

---

## 9) Non-Goals

* No GraphQL.
* No WebSockets (polling only).
* No multi-user access control (single user only).
* No rate limiting beyond refresh-QR and fetch-groups.

---

**End of BP-API.md**

---
