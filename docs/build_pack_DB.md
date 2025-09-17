---

# BP-DB — Supabase Schema & Migrations (MVP)

**Owner:** Backend (DB)
**Depends on:** MasterSpec-v1.0 (§ Database, API Contracts)
**Goal:** Create an idempotent Supabase schema for MVP, including tables, indexes, extensions, and storage bucket. Provide migration scripts, seed data, and acceptance checks.

---

## 1) Principles

* **Idempotent** migrations (safe to run multiple times).
* **Server-owned** access: RLS **disabled** for MVP (single user).
* **Private media**: Supabase Storage bucket `wa-media` (private) + signed URLs.
* **No schema drift**: changes only via migrations in repo.

---

## 2) Schema Overview

### Tables

* `public.groups`
* `public.media`
* `public.messages`
* `public.message_tags` *(not used in UI yet; optional, kept for future)*
* `public.block_groups` / `public.block_senders` / `public.block_keywords` *(optional guards)*
* `public.audit_log`
* `public.wa_sessions`
* `public.google_tokens`
* `public.runtime_flags`

### Extensions

* `uuid-ossp` — UUIDs
* `pg_trgm` — fuzzy search on text fields

### Storage

* Bucket `wa-media` (private)

---

## 3) Migration SQL (idempotent)

Save as `db/migrations/0001_init.sql`:

```sql
-- === EXTENSIONS ===
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm";

-- === GROUPS ===
create table if not exists public.groups (
  id uuid primary key default uuid_generate_v4(),
  wa_group_id text not null unique,
  name text not null,
  monitor boolean not null default false,
  last_seen_ts timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists groups_monitor_idx on public.groups (monitor);
create index if not exists groups_last_seen_ts_idx on public.groups (last_seen_ts);
create index if not exists groups_name_trgm_idx on public.groups using gin (name gin_trgm_ops);

-- === MEDIA ===
create table if not exists public.media (
  id uuid primary key default uuid_generate_v4(),
  sha256 char(64) not null unique,
  mime text not null,
  bytes bigint not null,
  width int,
  height int,
  duration_s numeric(10,3),
  storage_path text not null,
  ocr_text text,
  asr_text text,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists media_phash_idx on public.media ((meta->>'phash'));
create index if not exists media_ocr_trgm on public.media using gin (ocr_text gin_trgm_ops);
create index if not exists media_asr_trgm on public.media using gin (asr_text gin_trgm_ops);

-- === MESSAGES ===
create table if not exists public.messages (
  id uuid primary key default uuid_generate_v4(),
  wa_msg_id text not null unique,
  ts timestamptz not null,
  chat_id text not null,
  sender text not null,
  kind text not null check (kind in ('text','image','video','audio','doc','other')),
  text text,
  media_id uuid references public.media(id) on delete set null,
  group_id uuid references public.groups(id) on delete set null,
  parent_id uuid references public.messages(id) on delete set null,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists messages_chat_ts_idx on public.messages (chat_id, ts desc);
create index if not exists messages_text_trgm on public.messages using gin (text gin_trgm_ops);
create index if not exists messages_kind_idx on public.messages (kind);
create index if not exists messages_group_idx on public.messages (group_id);
create index if not exists messages_ts_idx on public.messages (ts desc);

-- === OPTIONAL TAGS (not used in UI yet) ===
create table if not exists public.message_tags (
  message_id uuid references public.messages(id) on delete cascade,
  tag text not null,
  primary key (message_id, tag)
);
create index if not exists message_tags_tag_idx on public.message_tags (tag);

-- === BLOCKLISTS (optional guards) ===
create table if not exists public.block_groups (
  wa_group_id text primary key,
  reason text,
  created_at timestamptz not null default now()
);
create table if not exists public.block_senders (
  sender text primary key,
  reason text,
  created_at timestamptz not null default now()
);
create table if not exists public.block_keywords (
  keyword text primary key,
  created_at timestamptz not null default now()
);

-- === AUDIT LOG ===
create table if not exists public.audit_log (
  id uuid primary key default uuid_generate_v4(),
  kind text not null check (kind in ('connect','disconnect','reconnect','qr_generated','discovery','group_rename','ingest','error')),
  at timestamptz not null default now(),
  detail jsonb not null default '{}'::jsonb
);
create index if not exists audit_log_at_desc_idx on public.audit_log (at desc);
create index if not exists audit_log_kind_idx on public.audit_log (kind);

-- === WA SESSIONS (worker state) ===
create table if not exists public.wa_sessions (
  id uuid primary key default uuid_generate_v4(),
  status text not null check (status in ('connected','connecting','disconnected')),
  wa_number text,
  wa_name text,
  creds_json jsonb not null default '{}'::jsonb,
  keys_json jsonb not null default '{}'::jsonb,
  detail jsonb not null default '{}'::jsonb, -- holds {qr, expiresAt, ...}
  last_status_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists wa_sessions_status_idx on public.wa_sessions (status);
create index if not exists wa_sessions_last_status_at_idx on public.wa_sessions (last_status_at desc);

-- Single-row constraint (MVP single WA session):
do $$
begin
  if not exists (select 1 from information_schema.table_constraints
    where table_name = 'wa_sessions' and constraint_name = 'wa_sessions_single_row_chk') then
    alter table public.wa_sessions
      add constraint wa_sessions_single_row_chk
      check ((select count(*) from public.wa_sessions) <= 1) not valid;
  end if;
exception when others then
  -- ignore if cannot add at this time
end$$;

-- === GOOGLE TOKENS (encrypted at rest by app) ===
create table if not exists public.google_tokens (
  id uuid primary key default uuid_generate_v4(),
  google_user_id text not null unique,
  email text not null,
  name text,
  picture_url text,
  access_token_enc text not null,
  refresh_token_enc text,
  expiry timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists google_tokens_email_idx on public.google_tokens (email);

-- === RUNTIME FLAGS (ui <-> worker signaling) ===
create table if not exists public.runtime_flags (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
-- Useful keys:
-- 'fetch_groups_requested' : { "at": "2025-01-01T12:00:00Z" }
-- 'wa_refresh_qr_requested': { "at": "..." }
```

> **Note:** The “single-row” check on `wa_sessions` is a soft guard; it’s `NOT VALID` to avoid blocking inserts during creation. The worker should still upsert/update a single row by convention.

---

## 4) Storage Bucket (private)

Create bucket `wa-media` (private). You can do this once via SQL:

```sql
-- Supabase: create storage bucket via RPC
insert into storage.buckets (id, name, public) values ('wa-media', 'wa-media', false)
on conflict (id) do nothing;
```

App writes objects like: `wa-media/{sha256}/original.<ext>`
No public policy; serve with **signed URLs** only (generated by server).

---

## 5) Helper Views (optional)

For quick admin reads, add a “latest per group” view:

```sql
create or replace view public.messages_latest_per_group as
select distinct on (chat_id) *
from public.messages
order by chat_id, ts desc;
```

---

## 6) Seed Data (minimal)

Save as `db/migrations/0002_seed.sql`:

```sql
-- Seed one wa_sessions row in 'disconnected' for UI to read
insert into public.wa_sessions (status, detail)
values ('disconnected', '{}'::jsonb)
on conflict do nothing;

-- Optional: sample group
insert into public.groups (wa_group_id, name, monitor)
values ('1203XXXXXXX@g.us', 'Sample Group', false)
on conflict (wa_group_id) do nothing;

-- Optional: runtime flags init
insert into public.runtime_flags (key, value)
values ('fetch_groups_requested', jsonb_build_object('at', now()))
on conflict (key) do nothing;
```

---

## 7) Migration Runbook

Add npm scripts in `apps/api/package.json` (or a dedicated `scripts/` dir) that use `supabase` CLI or `psql` against the project’s connection string.

Example (psql):

```bash
# .env contains: DATABASE_URL=postgresql://postgres:...@db.supabase.co:5432/postgres
export PGPASSWORD="$(jq -r .password supabase_local_admin.json)" # or inject via env
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/0001_init.sql
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/migrations/0002_seed.sql
```

> If using Supabase CLI migrations, place SQL files into `supabase/migrations/` and run `supabase db push` in CI.

---

## 8) Operational Notes

* **RLS**: Off for MVP; all access is server-side (API/worker using service role). Document clearly so no client uses service key.
* **Indexes**: verify with `EXPLAIN` that message queries by `(chat_id, ts desc)` and filters by `kind` hit indexes.
* **Vacuum/Analyze**: Supabase manages routine maintenance; high ingest may benefit from increasing autovacuum thresholds (not needed for MVP).
* **Constraints**:

  * `wa_msg_id` unique → idempotent ingest.
  * `media.sha256` unique → dedupe across messages.
  * `messages.kind` restricted to enum values.
* **Heuristic linking**: `parent_id` set by worker logic only (no DB trigger).

---

## 9) Programmatic Contracts (server expectations)

* **Generate signed URLs** on server using service key; TTL = `SIGNED_URL_TTL_DAYS` (default 7).
* **Media properties** (`width`, `height`, `duration_s`) are optional; populate when known.
* **Name changes** on groups: update `groups.name` and log `audit_log('group_rename', {from,to})`.
* **Discovery** never flips `monitor`; only UI toggle writes `monitor`.

---

## 10) Acceptance Criteria (DB)

* [ ] Running `0001_init.sql` twice yields **no errors** (idempotent).
* [ ] `uuid-ossp` + `pg_trgm` extensions exist.
* [ ] All tables and indexes exist (as defined).
* [ ] `wa_sessions` has **≤ 1 row** (seeded `disconnected`).
* [ ] Bucket `wa-media` exists and is **private**.
* [ ] Insert duplicate `wa_msg_id` → fails (unique constraint).
* [ ] Insert duplicate `sha256` → reuses media row (app responsibility) but DB unique prevents dup row.
* [ ] Query by `groups.monitor=true` returns expected rows.
* [ ] `GET /api/messages` (via API) can join `media` and return a **valid signed URL**.

---

## 11) Rollback Guidance

Keep rollbacks simple; for MVP, prefer **forward fixes**. If necessary, create `0001_down.sql` with **drop view/table** statements in reverse dependency order. Use with caution in non-prod only.

---

## 12) Future Migrations (post-MVP)

* Add `RLS` + per-user scoping when multi-tenant arrives.
* Add `albums`/`bundle_id` tables if WhatsApp exposes grouped media explicitly.
* Add `metrics` tables (ingest counters) for dashboards.
* Add `webhook_signing_secrets` if pushing to external systems.

---

**End of BP-DB.md**

---