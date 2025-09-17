
---

# BP-UI — Dashboard Build Pack (MVP)

**Owner:** Frontend
**Depends on:** MasterSpec-v1.0 (§ UI layout, API, states)
**Goal:** Implement the `/dashboard` SPA (desktop + mobile), wire it to the API, and meet accessibility + acceptance checks.

---

## 1) Scope

* Routes: `/` (login screen), `/dashboard` (protected).

* Build the **four panels** per spec:

  1. **Connection Status** (Google + WhatsApp cards; QR embedded in WA card)
  2. **Groups** (search + fetch + table + toggle + pagination)
  3. **Message Log** (filters + rows + media open)
  4. **System Activity** (recent audit items)

* Polling: `/api/status` & `/api/qr` every **2000ms**.

* Session guard: redirect to `/` on **401**.

* Toasts: success/error top-right.

* Accessibility: keyboard nav, ARIA, non-color cues.

---

## 2) Tech & Structure

* Vanilla JS (ES6+), HTML, CSS (or minimal framework if already chosen).
* **IDs must match** MasterSpec to simplify wiring & QA.
* Suggested structure:

```
apps/ui/
  public/
    index.html       # login
    dashboard.html   # dashboard shell
  src/
    ui.css
    app.js
    api.js           # fetch helpers
    polling.js
    toasts.js
    auth.js
    components/
      status.js
      qr.js
      groups.js
      messages.js
      activity.js
  server/
    index.ts         # Express for static + /api proxy if needed
```

---

## 3) Element IDs (must exist)

Header

* `hdr-title`, `btn-logout-google`, `btn-wa-disconnect`

Status Cards

* `status-cards`, `card-google`, `google-state-badge`, `google-avatar`, `google-email`
* `card-whatsapp`, `wa-state-badge`, `wa-name`, `wa-number`
* QR-in-card: `qr-canvas` (240×240), `btn-refresh-qr`, `qr-expires`

Groups

* `panel-groups`, `groups-search`, `btn-fetch-groups`
* `groups-table`, `groups-tbody`, `groups-prev`, `groups-next`, `groups-page`

Messages

* `panel-messages`, `msg-filter-group`, `msg-filter-kind`, `messages-list`

Activity

* `panel-activity`, `btn-clear-activity`, `activity-list`

Toasts

* `toaster`

---

## 4) API Wiring

Use the exact contracts from **MasterSpec-v1.0** / “API Contracts & Error Handling”.

* `GET /api/status` → update badges, google avatar/email, wa number/name.
* `GET /api/qr` → if `{qr, expiresAt}` render QR and countdown; else hide QR region.
* `POST /api/wa/refresh-qr` → force new QR (handle 409/429).
* `POST /api/wa/disconnect` → request soft disconnect.
* `GET /api/groups?search=&limit=&offset=` → render table + pagination.
* `POST /api/groups/:id/toggle {monitor}` → optimistic toggle; revert on error.
* `POST /api/fetch-groups-now` → green toast, no UI freeze.
* `GET /api/messages?limit=&offset=&groupId=&kind=` → render rows; `Open media` uses `media.signedUrl`.
* `GET /api/activity?limit=` → render last N events.

**401 handling:** on any 401 → `window.location = '/'`.
**Error model:** non-2xx → show red toast with `error.message` if present.

---

## 5) Polling & State

* Timer every **2000ms**:

  * `fetchStatus()` and update both cards.
  * If WA state != `connected` → `fetchQr()`. If `connected` → **stop QR polling** and hide QR area; show profile info.
* Resume QR polling automatically when WA flips to `disconnected/connecting`.

---

## 6) UI Behavior (per control)

### Header buttons

* `btn-logout-google` → `POST /api/logout` → on 200 redirect `/`.
* `btn-wa-disconnect` → `POST /api/wa/disconnect` → toast “Disconnect requested”, WA card should soon show `connecting/disconnected`.

### WhatsApp card (QR inside)

* Show **badge** pill with color (green/amber/gray) and **text** (“CONNECTED”, “CONNECTING”, “DISCONNECTED”).
* When QR visible:

  * Render to `qr-canvas` from raw string (use a lightweight QR lib).
  * Show `qr-expires` (“Expires in Ns”).
  * `btn-refresh-qr` → `POST /api/wa/refresh-qr`, handle `409/429` gracefully.
* When connected:

  * Hide QR nodes (keep card height stable if possible).
  * Show `wa-name` & `wa-number`.

### Groups

* Search (`groups-search`) debounced **250–300ms** → call `GET /api/groups`.
* `btn-fetch-groups` → `POST /api/fetch-groups-now` → toast “Discovery triggered”.
* Table rows:

  * Render Name (truncate, `title` attr), Group ID (mono, copy icon optional), Toggle.
  * Toggle invokes `POST /api/groups/:id/toggle {monitor}` with optimistic UI; if error → revert + red toast.
* Pagination: maintain `limit` (25) & `offset`; update `groups-page` with “Page X (Y total)”.

### Message Log

* Filters:

  * `msg-filter-group` populated from groups list (All = ‘’, else internal `group.id`).
  * `msg-filter-kind` values: All | text | image | video | audio | doc | other.
* List items show:

  * Row 1: time (local, `YYYY-MM-DD HH:mm:ss`) + group name.
  * Row 2: kind badge + sender.
  * Row 3: text (max 2 lines) **or** `Open media` button (opens `media.signedUrl` in new tab).
  * If `parent_id` present → show small chain icon with `title="Linked to related message"`.

### System Activity

* Fetch last **5–20** items on load and every **10s** (or piggyback on status poll).
* Render icon by kind:

  * success (`connect`, `qr_generated`, `reconnect`) ✓
  * info (`discovery`, `group_rename`) ℹ︎
  * error (`error`) ✕
* `btn-clear-activity` clears **UI only** (MVP does not delete server logs).

---

## 7) Styling (tokens & essentials)

* Spacing: 8 / 12 / 16 / 24 / 32 px.
* Cards: white bg, `#E5E7EB` 1px border, radius 8px, padding 16px, light shadow.
* Badges (pill, 20px height):

  * connected `#10B981`, connecting `#F59E0B`, disconnected `#9CA3AF`.
* Buttons: primary blue `#3B82F6`, secondary gray `#6B7280`, radius 6px, 32px height.
* Toggles: 36×20px, clear on/off.
* Tables: zebra rows, sticky header, hover row, monospace for Group ID.
* Toasts: top-right, rounded 6px, shadow, auto-hide 3s (success green, error red).

---

## 8) Accessibility

* All actionable elements reachable via **Tab** in logical order.
* Buttons/toggles have `aria-label`.
* Badges include text (not color-only).
* Preserve scroll on list updates (no layout jump).
* Provide focus outlines on keyboard nav.

---

## 9) Tasks (checklist)

* [ ] **Route guard**: redirect `/dashboard`→`/` on 401.
* [ ] **Header** with title + two buttons wired.
* [ ] **Status cards** with badges + QR in WA card.
* [ ] **Polling** loop (2s), stop QR when connected.
* [ ] **Groups** list + search + pagination + toggle + fetch button.
* [ ] **Message Log** with filters + rows + `Open media`.
* [ ] **System Activity** list + icons + UI clear.
* [ ] **Toasts** utility (success/error).
* [ ] **Accessibility**: tab order, aria labels, focus outlines.
* [ ] **Mobile** layout stack: Status → Groups → Messages → Activity (or Status → QR (in card) → Groups → Messages → Activity if QR visible).
* [ ] **Error handling** per error model (401/400/409/429).

---

## 10) Acceptance Criteria (QA)

**Auth/Guard**

* [ ] Visiting `/dashboard` without session → redirected to `/`.
* [ ] After login, `/dashboard` loads; `GET /api/status` called.

**Status & QR**

* [ ] When WA `disconnected` or `connecting` → QR visible inside card with countdown.
* [ ] When WA `connected` → QR hidden; name + number displayed.
* [ ] Clicking **Refresh QR** → 202 + new QR (or 409 if connected).
* [ ] **Disconnect WhatsApp** → card shows `connecting/disconnected` within seconds.

**Groups**

* [ ] Search filters table within 300ms (debounced).
* [ ] Toggle ON persists and survives page reload.
* [ ] `Fetch new groups` shows green toast; existing monitor flags unchanged.

**Message Log**

* [ ] Filtering by group + kind updates list.
* [ ] `Open media` opens a valid signed URL in a new tab.
* [ ] Rows show time, group, kind badge, sender, and content/cta.

**Activity**

* [ ] New events appear (e.g., discovery, reconnect, error).
* [ ] “Clear” empties the **UI** list only.

**UX**

* [ ] Polling interval exactly **2000ms**; QR polling halts on connect.
* [ ] No layout jitter when WA state flips (card height stable).
* [ ] Keyboard-only navigation can operate all controls.

---

## 11) Notes / Non-Goals

* No Google **Sign in** button on dashboard; only **Logout Google** in header.
* Activity “Clear” is client-side only in MVP.
* No infinite scroll; use simple pagination.
* No historical fetch; ingest is live-only.
* Do **not** expose Supabase keys to the browser.

---

## 12) Dev Tips

* Centralize `fetchJSON(url, opts)` to handle 401, JSON parsing, and error toasts.
* Keep a simple in-memory **view model** (status, groups page, filters, messages page) to avoid tangled state.
* For QR rendering, a tiny lib like `qrcode` works; avoid heavy deps.
* Use `Intl.DateTimeFormat` with user timezone for timestamps.

---

## 13) Out of Scope (future)

* Dark mode, theme switching.
* Reorderable columns, export to CSV.
* Persistent client cache.
* Realtime websockets (we use polling in MVP).

---

**End of BP-UI.md**
