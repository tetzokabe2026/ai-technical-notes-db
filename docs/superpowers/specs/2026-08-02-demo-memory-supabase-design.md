# Design: Demo in-memory Supabase mode

**Date:** 2026-08-02  
**Repo:** `tetzokabe2026/ai-technical-notes-db`  
**Purpose:** Jenkins `eapi-client-sync` GUI demo recording can run without a real Supabase project.

## Goal

When `DEMO_SUPABASE_MODE=memory`, the app must not connect to real Supabase. Login, note creation, and rating persistence must work against an in-process store so `npm run build && npm run start` supports GUI recording without shared DB credentials or migrations.

## Non-goals

- Shared Supabase migration or writes
- Production path changes beyond the approved login client swap
- Playwright e2e
- Full Supabase Auth Admin API surface
- Mocking `NOTE_RATING_API_URL` (existing optional rating fetch stays as-is)

## Decisions

| Topic | Decision |
|---|---|
| Approach | Thin in-memory client mimicking the used Supabase JS surface |
| Login | `app/api/auth/login/route.ts` uses `getSupabaseAuthClient().auth.signInWithPassword` |
| Env when memory | Real Supabase URL / anon / service role keys are **not required** |
| Seed | Approved admin from `DEMO_ADMIN_*` + one `Finance` category |
| Notes table | Existing name `technical_notes` (not renamed) |
| Ratings | `rating_*` (and any other columns) accepted on update without schema validation |

## Architecture

```text
DEMO_SUPABASE_MODE=memory
  -> lib/demo-mode.ts (isDemoMemoryMode)
  -> getSupabaseAdmin / getSupabaseAuthClient
       return createDemoMemorySupabase()
  -> process-local Maps:
       technical_notes / categories / app_users + auth sessions
  -> no network to Supabase

default
  -> existing createClient(...)
```

### New files

- `lib/demo-mode.ts` — `isDemoMemoryMode()` (`process.env.DEMO_SUPABASE_MODE === "memory"`)
- `lib/demo-memory-supabase.ts` — in-memory store + query/auth client factory

### Modified files

- `lib/supabase-server.ts` — if memory mode, return memory client; skip URL/service-role validation
- `lib/supabase-auth.ts` — same for auth client; skip URL/anon validation
- `app/api/auth/login/route.ts` — replace inline `createClient` with `getSupabaseAuthClient()`
- `README.md`, `.env.example` — document demo env vars
- Unit tests under `tests/lib/`

## Data & auth surface

### Seed (once per process on first client creation)

- `app_users`: one approved `admin` with `DEMO_ADMIN_EMAIL` / `DEMO_ADMIN_PASSWORD`, fixed `auth_user_id`
- `categories`: one row named `Finance` owned by that admin
- `technical_notes`: empty

### Auth (minimum)

- `signInWithPassword({ email, password })` — success issues opaque access + refresh tokens
- `getUser(accessToken)` — resolve token to seeded auth user
- `refreshSession({ refresh_token })` — rotate/return session if token known
- Other auth admin APIs: out of demo scope (may throw or no-op if accidentally hit)

### Query builder (minimum for login / notes / rating save)

- `from(table).select|insert|update|delete`
- Filters: `eq`, `neq`, `order`, `or`, `ilike`, `in`
- Terminators: `maybeSingle`, `single`, thenable await
- Nested select `*, categories(id, name)` on `technical_notes`: simple join by `category_id`
- Updates merge arbitrary fields (including `rating_eval_id`, `rating_usefulness`, `rating_importance`, `rating_credibility`) with no schema checks

Unsupported query shapes used only by non-demo paths may fail; that is acceptable.

## Environment

| Variable | Required when | Meaning |
|---|---|---|
| `DEMO_SUPABASE_MODE` | set to `memory` to enable | Activates in-memory client |
| `DEMO_ADMIN_EMAIL` | memory mode | Seeded admin email |
| `DEMO_ADMIN_PASSWORD` | memory mode | Seeded admin password |
| `NEXT_PUBLIC_SUPABASE_*` / `SUPABASE_SERVICE_ROLE_KEY` | **not** required in memory | Ignored / unused |
| `NOTE_RATING_API_URL` | optional | Existing rating fetch; persistence still goes to memory store |

## Testing

Unit tests only:

1. `isDemoMemoryMode` true/false
2. Memory client: sign-in success, note insert, rating update
3. `getSupabaseAdmin` / `getSupabaseAuthClient` in memory mode return memory client without calling `@supabase/supabase-js` `createClient`

No Playwright.

## Acceptance

```bash
DEMO_SUPABASE_MODE=memory \
DEMO_ADMIN_EMAIL=demo@example.com \
DEMO_ADMIN_PASSWORD=demo-password-ok \
npm run build && npm run start
```

Then: login → create note → rating fields persist — all without a real Supabase database.

## Error handling

- Memory mode missing `DEMO_ADMIN_EMAIL` or `DEMO_ADMIN_PASSWORD`: throw a clear error at client creation / seed time
- Bad login credentials: same 401 shape as production login route
- Non-memory mode: unchanged validation of Supabase URL / keys
