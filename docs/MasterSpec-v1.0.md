
---

# WA Monitor – Master Spec v1.0

## 📋 Scope

MVP system for monitoring **selected WhatsApp groups** (via Baileys), storing messages/media in **Supabase**, and controlling monitoring via a **web dashboard**.

**In Scope (MVP):**

* One Google user (login required for dashboard access).
* One WhatsApp account (single QR login).
* Group discovery + toggle monitoring.
* Ingest live messages/media only (no history).
* Message log with filters.
* System activity/audit log.
* DO App Platform deployment.

**Out of Scope (MVP):**

* Multi-user or multi-tenant support.
* Historical sync.
* n8n automations (reserved for later).
* Media normalization/OCR/ASR (reserved for later).

---

## 🏗️ Architecture

```
User → Browser (Dashboard SPA)
       ↕ HTTPS
DO App Platform (Node.js App)
 ├── API (Express)
 ├── Worker (Baileys + ingest)
 └── Supabase (Postgres + Storage)
```

### Components

* **Frontend**: Minimal HTML/JS dashboard, responsive layout.
* **Backend API**: Express routes for status, groups, messages, QR, auth.
* **Worker**: Baileys client, Supabase writer, media handler.
* **Database**: Supabase Postgres (messages, media, groups, audit, sessions).
* **Storage**: Supabase Storage bucket (`wa-media`, private).
* **Auth**: Google OAuth (login required for dashboard access).
* **Deployment**: DigitalOcean App Platform (2 services: API/UI + Worker).

---

## 🔑 User Flows

1. **Login**

   * User opens `/`.
   * Shown “Sign in with Google” button.
   * On success → session cookie set → redirect to `/dashboard`.
   * Without Google session → access denied.

2. **Dashboard**

   * Header: `WA Monitor` + \[Logout Google] + \[Disconnect WhatsApp].
   * Status cards: Google + WhatsApp.

     * Google: show avatar/email if connected.
     * WhatsApp: show QR when disconnected, profile info when connected.
   * Groups panel:

     * List groups, search, toggle monitoring.
     * \[Fetch new groups] to discover new chats.
   * Message log:

     * Filter by group or kind.
     * Show time, sender, kind, text or \[Open Media].
   * System activity:

     * Show audit log entries (connect, ingest, errors).
     * Last 5 items, scrollable, clear button.

3. **Logout**

   * \[Logout Google] → clear session → redirect to login page.
   * \[Disconnect WhatsApp] → clear WA session, return to QR state.

---

## 🗄️ Database (Supabase)

### groups

| Column         | Type        | Notes                    |
| -------------- | ----------- | ------------------------ |
| id             | uuid pk     |                          |
| wa\_group\_id  | text        | WA group JID (unique)    |
| name           | text        |                          |
| monitor        | boolean     | true/false (user toggle) |
| last\_seen\_ts | timestamptz | updated on ingest        |
| created\_at    | timestamptz | default now()            |

### media

| Column        | Type        | Notes              |
| ------------- | ----------- | ------------------ |
| id            | uuid pk     |                    |
| sha256        | char(64)    | unique checksum    |
| mime          | text        |                    |
| bytes         | bigint      | file size          |
| width         | int         | images/video       |
| height        | int         | images/video       |
| duration\_s   | numeric     | audio/video length |
| storage\_path | text        | Supabase path      |
| created\_at   | timestamptz | default now()      |

### messages

| Column      | Type        | Notes                      |
| ----------- | ----------- | -------------------------- |
| id          | uuid pk     |                            |
| wa\_msg\_id | text        | unique WA message id       |
| ts          | timestamptz | message timestamp          |
| chat\_id    | text        | WA group JID               |
| sender      | text        | E.164 phone                |
| kind        | text        | text/image/video/audio/doc |
| text        | text        | message body               |
| media\_id   | uuid fk     | → media.id (nullable)      |
| group\_id   | uuid fk     | → groups.id                |
| parent\_id  | uuid fk     | → messages.id (nullable)   |
| created\_at | timestamptz | default now()              |

### audit\_log

| Column | Type        | Notes                           |
| ------ | ----------- | ------------------------------- |
| id     | uuid pk     |                                 |
| kind   | text        | connect/disconnect/ingest/error |
| at     | timestamptz | default now()                   |
| detail | jsonb       | raw detail for debugging        |

### sessions

| Column      | Type        | Notes                       |
| ----------- | ----------- | --------------------------- |
| id          | uuid pk     |                             |
| type        | text        | google\_token / wa\_session |
| data        | jsonb       | encrypted, server-only      |
| created\_at | timestamptz | default now()               |

---

## 🌐 API Contracts

### Auth

* `/auth/google` → starts OAuth.
* `/auth/callback` → handles callback, sets cookie.
* `/auth/logout` → clears cookie.

### Status

* `GET /api/status`

```json
{
  "google": { "connected": true, "email": "user@x.com", "avatar": "…" },
  "whatsapp": { "state": "connected", "name": "John", "number": "+9725…" }
}
```

### QR

* `GET /api/qr`

```json
{ "qr": "base64string", "expiresAt": "2025-09-17T12:00:00Z" }
```

### Groups

* `GET /api/groups?search=&page=1`
* `POST /api/groups/:id/toggle { "monitor": true }`
* `POST /api/fetch-groups-now`

### Messages

* `GET /api/messages?limit=50&offset=0&groupId=&kind=`

```json
[
  {
    "id":"msg_1","ts":"2025-01-01T12:00:00Z",
    "group":"Deals TLV","sender":"+9725…",
    "kind":"image","text":"3br 1.8M TLV",
    "mediaUrl":"https://…signed","parentId":null
  }
]
```

### Activity

* `GET /api/activity` → last 20 audit entries.

---

## ⚙️ Worker (Baileys)

* Connect via QR login.
* Persist session in `sessions` table.
* Reconnect with backoff.
* Ingest new messages only (ts > now-30s).
* Media pipeline:

  * Download → sha256 → store in Supabase bucket.
  * Insert `media` row, link to `messages`.
* Parent linking heuristic:

  * If text + media within 90s by same sender → set parent\_id.

---

## 🔒 Security

* Supabase Service Role Key only on server.
* Storage bucket private; signed URLs (7d TTL).
* Session cookies httpOnly, secure.
* Input validation (zod).
* No PII export.

---

## 📊 Monitoring

* `/healthz` returns 200.
* Logs written to audit\_log + stdout.
* Activity panel shows last 5 events.

---

## ✅ Acceptance Checklist

* [ ] Login only possible via Google.
* [ ] Without login → dashboard blocked.
* [ ] QR shows when disconnected; hides when connected.
* [ ] Groups can be toggled, state persists in DB.
* [ ] New messages appear in log within 2s.
* [ ] Media links open in browser, valid for 7d.
* [ ] Activity log shows connect/disconnect/errors.
* [ ] Logout returns to login page.

---

**Version:** 1.0
**Date:** 2025-09-17

---
