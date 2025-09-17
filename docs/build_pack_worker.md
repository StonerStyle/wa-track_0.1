
# BP-WORKER — Baileys + Ingest Pipeline (MVP)

**Owner:** Backend (Worker service)
**Depends on:** MasterSpec-v1.0 (§ Worker, DB, API), BP-DB.md
**Goal:** Implement a stateless worker that connects to WhatsApp via **Baileys**, persists session state & QR in **Supabase**, discovers groups, and ingests live messages + media into DB/Storage with idempotency and basic retries.

---

## 1) Scope

* Single WhatsApp session (one account).
* **Live-only** ingest (ignore history).
* Group discovery (manual trigger) → upsert groups (never touch `monitor`).
* Message ingest for **monitored** groups only.
* Media store to **Supabase Storage** (private bucket `wa-media`), dedupe by **sha256**.
* Heuristic **parent linking** (text ↔ media within 90s by same sender).
* Write `audit_log` for key events (`qr_generated`, `connect`, `disconnect`, `reconnect`, `discovery`, `error`).
* Expose `/healthz` HTTP endpoint for liveness.

**Non-goals (MVP):** throttling, OCR/ASR, albums detection beyond simple heuristic, multi-user/multi-session.

---

## 2) Service Layout

```
apps/worker/
  src/
    index.ts           # bootstrap + http /healthz
    env.ts             # env parsing/validation
    log.ts             # pino logger
    supa.ts            # supabase clients (db + storage)
    runtimeFlags.ts    # helpers for runtime_flags
    wa/
      client.ts        # Baileys wiring (connect/QR/events)
      stateStore.ts    # Supabase-backed auth state (creds/keys)
      handlers.ts      # message handlers, group discovery
    ingest/
      media.ts         # download, sha256, detect mime/ext, upload
      messages.ts      # db upsert, parent linking
    util/
      hash.ts          # sha256 stream
      mime.ts          # basic mime detection from headers/meta
      time.ts
```

---

## 3) Environment

Required:

* `SUPABASE_URL`
* `SUPABASE_SERVICE_KEY`
* `SIGNED_URL_TTL_DAYS` (API uses; worker doesn’t sign)
* `LOG_LEVEL` (default `info`)

Optional:

* `WORKER_POLL_MS` (default 2000) for runtime flag checks
* `WORKER_MAX_MEDIA_MB` (default 25)
* `WORKER_BACKOFF_BASE_MS` (default 1000) — reconnect base
* `WORKER_BACKOFF_MAX_MS` (default 30000)

---

## 4) Supabase Contract Usage

Tables used (write): `wa_sessions`, `groups`, `messages`, `media`, `audit_log`, `runtime_flags`.

* **wa\_sessions**: single row is the source of truth for WA state.

  * `status`: `connecting|connected|disconnected`
  * `detail.qr`, `detail.expiresAt` (when QR active)
  * `wa_name`, `wa_number` once known
  * `creds_json`, `keys_json` for Baileys auth state
* **runtime\_flags** (UI → worker signaling):

  * `fetch_groups_requested` : `{ "at": ISO }`
  * `wa_refresh_qr_requested`: `{ "at": ISO }`
  * `wa_disconnect_requested`: `{ "at": ISO }`

> Worker **consumes** these flags (compares timestamps) and **writes results** to `wa_sessions` + `audit_log`.

---

## 5) Lifecycle

### Boot

1. Connect to Supabase.
2. Ensure one row in `wa_sessions` exists; if not, insert `{status:'disconnected'}`.
3. Initialize Baileys with **custom auth state** backed by Supabase (`stateStore.ts`):

   * Read/write `creds_json` + `keys_json`.
4. Start **flag watcher** loop (every `WORKER_POLL_MS`, default 2s).
5. Start HTTP server on `0.0.0.0:3001` with `GET /healthz` → `{ ok: true }`.

### Connect

* Set `wa_sessions.status='connecting'`.
* When Baileys requests a QR:

  * Write `detail.qr` (raw string) + `detail.expiresAt` (now + 30–60s).
  * `audit_log('qr_generated')`.
* On successful connection:

  * `status='connected'`, clear QR fields, write `wa_name/wa_number` if available, `audit_log('connect')`.

### Reconnect / Disconnect

* Baileys events: on close → set `status='disconnected'`, `audit_log('disconnect')`.
* Apply exponential backoff with jitter between reconnect attempts:

  * `backoff = min(BACKOFF_MAX, BACKOFF_BASE * 2^retries) + jitter(0..500ms)`.
* If `wa_disconnect_requested` flag set → gracefully logout/end → set `disconnected` and clear flag → `audit_log('disconnect')`.

---

## 6) Group Discovery

Triggered when:

* `fetch_groups_requested` flag timestamp is **newer** than last handled.
* (Optional) also run on first `connected`.

**Steps:**

1. Fetch chats/groups via Baileys (only groups), **don’t enumerate members**.
2. Upsert into `groups (wa_group_id, name)`; never modify `monitor`.
3. If `name` changed vs DB, update and `audit_log('group_rename', {from,to,wa_group_id})`.
4. `audit_log('discovery', {count:N})`.

---

## 7) Ingest Pipeline

**Events:** `messages.upsert` / `messages.update` (Baileys).
**Guard:** Discard anything with `ts < now - 30s` (live-only).

**Routing:**

* Resolve `group_id` from `groups.wa_group_id`.
* If `groups.monitor=false` → **skip** persist (optional: count as dropped in audit).

**Message persist:**

* Upsert `messages` by `wa_msg_id` with:

  * `ts`, `chat_id`, `sender`, `kind`, `text`, `raw` (subset of WA payload)
  * `group_id` fk
* If **media**:

  1. Download stream (from Baileys msg context).
  2. Compute **sha256** while streaming.
  3. If `media.sha256` exists → reuse its `id`; else:

     * Detect `mime` & extension (from headers/bytes).
     * Get **width/height/duration** when available from WA payload/meta (no heavy decoders in MVP).
     * Upload to `wa-media/{sha256}/original.<ext>` (private).
     * Insert `media` row with **sha256/mime/bytes/(width|height|duration\_s)/storage\_path**.
  4. Update `messages.media_id` with linked id.

**Parent linking heuristic (90s, both directions):**

* If `kind='text'` and next message within 90s by same `sender` in same `chat_id` and is media → set next.media.parent\_id = text.id.
* If media arrives first, link the **next text** within 90s by same sender back to this media’s message.
* Store `parent_id` on the “later” message (one-to-one link is enough for MVP).

**Limits & guards (MVP defaults):**

* Max media size: `WORKER_MAX_MEDIA_MB` (25 MB). Drop larger with `audit_log('error', {code:'MEDIA_TOO_LARGE'})`.
* Allowed mime starts with `image/`, `video/`, `audio/`, `application/pdf`, `application/*zip*`, otherwise store as `other` if small.

**Retries:**

* Storage upload / DB insert transient errors → **retry once** after 500–1000ms.
* On failure after retry → `audit_log('error', {code, msg, ctx: {wa_msg_id}})` and continue.

---

## 8) Logging / Audit

Write to `audit_log` for:

* `qr_generated`
* `connect`, `disconnect`, `reconnect`
* `discovery` (with count)
* `group_rename` (from → to)
* `ingest` (optional, keep sparse)
* `error` (include `code` & minimal message)

> Keep payloads small; heavy raw payload goes to `messages.raw` instead.

---

## 9) HTTP Health

Tiny server:

```ts
app.get('/healthz', (_req, res) => res.json({ ok: true }));
```

Use in DO App Platform health checks.

---

## 10) Implementation Notes

### 10.1 Baileys auth state (Supabase-backed)

* Implement `stateStore.ts` exposing Baileys’ `useMultiFileAuthState`-like interface backed by Supabase:

  * Read/write `creds_json` and `keys_json` blobs into `wa_sessions` single row.
  * Wrap updates in small transactions (or optimistic updates) to avoid races.

### 10.2 Hashing / MIME

* `sha256(stream)` with Node `crypto` as data flows (no temp files if possible).
* MIME from Baileys message metadata or head sniff; fall back on extension mapping.

### 10.3 Time

* Always store timestamps as **UTC** (`timestamptz` in DB).
* Compare with DB `now()` where possible to avoid local clock drift (minor for MVP).

### 10.4 Discovery does not flip toggles

* Respect user choice: never mutate `groups.monitor`.

---

## 11) Pseudocode (key flows)

```ts
// boot
await ensureWaSessionRow()
await startHealthServer()
await startFlagWatcher()
await connectBaileys()

// connectBaileys
setSession({ status:'connecting' })
client.on('qr', (qr, ttlSec) => {
  setSession({ detail:{ qr, expiresAt: new Date(Date.now()+ttlSec*1000).toISOString() }})
  audit('qr_generated', {})
})
client.on('connection.update', (u) => {
  if (u.connection === 'open') {
    setSession({ status:'connected', detail:{}, wa_name: u.user?.name, wa_number: u.user?.id })
    audit('connect', {})
  }
  if (u.connection === 'close') {
    setSession({ status:'disconnected' })
    audit('disconnect', { reason: u.lastDisconnect?.error?.message })
    scheduleReconnectWithBackoff()
  }
})
client.ev.on('messages.upsert', onMessagesUpsert)
```

```ts
async function onMessagesUpsert(ev) {
  for (const m of ev.messages) {
    if (!isRecent(m.messageTimestamp)) continue
    const chatId = m.key.remoteJid
    const group = await findOrNullGroup(chatId)
    if (!group || !group.monitor) continue

    const base = normalizeMessage(m) // ts, sender, kind, text, raw subset
    const msgId = await upsertMessageByWaId(base, group.id)

    if (hasMedia(m)) {
      const stream = await downloadMediaStream(m)
      const { sha256, bytes } = await hashStream(stream)
      const mediaId = await findOrCreateMedia({ sha256, bytes, mime, dims, duration, path })
      await linkMessageMedia(msgId, mediaId)
    }

    await tryLinkParentHeuristic(chatId, base.sender, msgId, base.kind, base.ts)
  }
}
```

---

## 12) Tasks (checklist)

* [ ] Env loader + logger.
* [ ] Supabase clients (db + storage).
* [ ] `wa_sessions` row ensure/init.
* [ ] Supabase-backed Baileys auth state (creds/keys persistence).
* [ ] Baileys client wiring + QR writeback + status transitions.
* [ ] Flag watcher (2s): `fetch_groups_requested`, `wa_refresh_qr_requested`, `wa_disconnect_requested`.
* [ ] Group discovery: upsert names, never flip `monitor`, audit counts.
* [ ] Ingest: upsert message by `wa_msg_id`; media download → sha256 → upload → `media` row; link `media_id`.
* [ ] Parent linking heuristic (±90s, same chat/sender).
* [ ] Size/mime guards; retry once on transient errors.
* [ ] `/healthz` server.
* [ ] Unit tests for utils (hash, time, parent heuristic).
* [ ] Manual E2E: simulate messages; verify DB rows + storage objects + audit logs.

---

## 13) Acceptance Criteria (QA)

* [ ] On start, `wa_sessions` shows `connecting` then `connected` after QR scan.
* [ ] QR is written to `wa_sessions.detail` with a future `expiresAt`.
* [ ] Trigger `fetch-groups-now` → groups upserted, existing `monitor` flags preserved.
* [ ] Send test messages to a **monitored** group → rows appear in `messages`; non-monitored group is ignored.
* [ ] Send media (≤25 MB) → object appears in `wa-media/{sha256}/original.ext`; `media` row created; `messages.media_id` linked.
* [ ] Duplicate media across messages reuses same `media.id` (confirmed via sha256).
* [ ] A text then image within 90s by same sender links via `parent_id`.
* [ ] Worker logs `audit_log` for `connect`, `qr_generated`, `discovery`, and `error` on forced failure.
* [ ] `/healthz` returns `{ ok: true }`.

---

## 14) Future (post-MVP)

* Throttling / backpressure via queue (BullMQ/Redis).
* OCR/ASR enrichment, pHash near-dup.
* Multi-session (plural `wa_sessions`, RLS + user scoping).
* Websocket push to UI (replace polling).
* Albums/bundles first-class entities.

---

**End of BP-WORKER.md**
