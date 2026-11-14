# YarnStash — Architecture at a Glance

A tour of how the app is put together, for someone who wants the shape of the
system before diving into files. For the deep dive on one specific flow, see
[`pattern-upload-flow.md`](./pattern-upload-flow.md).

---

## 1. What this thing is

YarnStash is a **knitting project manager**. Four jobs, roughly:

| Feature | What it does | Status |
|---|---|---|
| **Yarn catalog** | Browse ~98k yarns imported from Ravelry | Real data |
| **Your stash** | Track yarn you own — add by hand, by ball-band photo, or by receipt | Real data |
| **Patterns** | Upload a pattern PDF, get it read and structured by Claude, knit from it | Real data |
| **Projects / queue** | Track projects from queued → in progress → done | ⚠️ **Mock data only** |

That last row matters: `/dashboard` and `/queue` currently render from
`lib/data/mockProjects.ts` and `lib/data/mockYarns.ts`. The `projects` and
`project_yarns` tables exist in the database, but no API route or UI reads them
yet. Everything else is live.

---

## 2. The 10,000-foot view

It's a **single Next.js app**. There is no separate backend service — the API
routes *are* the backend. Three external systems hang off it.

```
                    ┌──────────────────────────────────────┐
                    │            Your browser              │
                    │   React 19 client components         │
                    │   + AuthContext + UploadContext      │
                    └───────────────┬──────────────────────┘
                                    │  fetch('/api/...')
                                    ▼
    ┌───────────────────────────────────────────────────────────────┐
    │                    Next.js 16 (App Router)                    │
    │                                                               │
    │   middleware.ts ──► routing gate: signed out? → back to "/"   │
    │                                                               │
    │   app/api/*  ──► the backend. auth check → query → JSON       │
    │   app/*      ──► the pages. mostly 'use client'               │
    └───────┬───────────────────────┬───────────────────────┬───────┘
            │                       │                       │
            ▼                       ▼                       ▼
    ┌───────────────┐      ┌─────────────────┐     ┌────────────────┐
    │   Supabase    │      │  Anthropic API  │     │  Ravelry API   │
    │               │      │                 │     │                │
    │ Postgres+RLS  │      │ reads PDFs and  │     │ one-off import │
    │ Auth          │      │ photos, returns │     │ script, not a  │
    │ Storage (PDFs)│      │ structured JSON │     │ runtime dep    │
    └───────────────┘      └─────────────────┘     └────────────────┘
```

**Stack:** Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 ·
Supabase (Postgres + Auth + Storage) · Anthropic SDK.

---

## 3. How a request actually flows

Take "show me my stash":

```
1. Browser hits /stash
      │
2. middleware.ts   Is there a valid-looking Supabase session cookie?
      │            No  → redirect to "/" (the marketing page)
      │            Yes → let it through
      ▼
3. app/stash/page.tsx renders (client component)
      │  useAuth() confirms the user — second layer, not the gate
      │  fetch('/api/stash')
      ▼
4. app/api/stash/route.ts
      │  createServerClient()        reads auth cookie from next/headers
      │  supabase.auth.getUser()     401 if not signed in
      │  .from('stash_yarns').select().eq('user_id', user.id)
      ▼
5. Postgres RLS re-checks auth.uid() = user_id anyway
      │
6. NextResponse.json({ yarns })  →  page swaps skeleton for content
```

### Three layers of auth, on purpose

| Layer | File | What it stops | Is it the security boundary? |
|---|---|---|---|
| Route gate | `middleware.ts` | Signed-out visitors *loading* a protected page at all | **No** — it's a UX/routing gate |
| Route check | every `app/api/*/route.ts` | Unauthenticated API calls (returns `401` JSON) | Yes |
| RLS | Postgres policies on every user-scoped table | Anything that slips past the above | **Yes — the real one** |

Two deliberate quirks worth knowing:

- **`/api/*` is exempt from middleware.** API routes authenticate themselves and
  answer `401` in JSON. Redirecting them to an HTML login page would break that
  contract for every client.
- **The cookie check fails closed.** An unreadable or junk cookie counts as
  signed out, so pasting `sb-<ref>-auth-token=junk` into devtools can't walk
  past the gate. The cost: if supabase-js ever changes how it encodes the
  session, everyone gets locked out until the parser is updated — a loud
  failure, which is the right direction to fail in.

---

## 4. Two kinds of Supabase client (this trips people up)

Three client factories, each with a different identity:

| File | Runs where | Identity | Sees RLS? |
|---|---|---|---|
| `lib/supabase/client.ts` | Browser | The signed-in user | Yes |
| `lib/supabase/server.ts` | API routes, server components | The signed-in user (cookie from `next/headers`) | Yes |
| `lib/supabase/admin.ts` | Background worker, import scripts | Service role | **No — bypasses RLS** |

The admin client exists because the pattern extraction worker runs *after* the
HTTP response is sent, so there are no request cookies left to authenticate
with. That's also why `/api/patterns/upload/extract` verifies
`storagePath.startsWith(user.id + '/')` before queueing — once work is handed to
the service-role worker, that check is the **only** thing enforcing ownership.

The browser client is a lazy `Proxy`, so importing it doesn't blow up at module
load when env vars are missing — it throws on first *use* instead.

---

## 5. The data model

### User-scoped (RLS: `auth.uid() = user_id`)

```
stash_yarns            yarn you own
projects ──┐           (tables exist, UI still on mock data)
           └─ project_yarns

patterns ──┬─ pattern_details        gauge, needles, sizes, finished measurements
           ├─ pattern_materials      yarn/notions the pattern calls for
           ├─ pattern_sections ──┬── pattern_instructions   (written steps)
           │                     └── content JSONB          (charts, schematics…)
           ├─ pattern_stitch_glossary
           ├─ pattern_notes
           └─ user_pattern_progress  where you are in the knit (the "WIP")

pattern_jobs           background extraction queue — read-only to users,
                       written only by the service-role worker
```

### Global (read-only to any signed-in user)

```
yarns ──┬─ yarn_fibers
        └─ yarn_photos
```

`yarns` is the Ravelry import: ~98k rows, ~14.8k distinct brands. It carries a
`search_vector` tsvector for full-text search and a `raw_data` JSONB blob with
the untouched Ravelry response (deliberately excluded from list queries — too
big).

### The one clever bit: polymorphic pattern sections

A pattern section can be prose, a chart, a schematic… so `pattern_sections` has
a `section_type` discriminator:

- `written_instructions` → rows in the **`pattern_instructions` table**
- `chart`, `stitch_pattern`, `schematic`, `notes` → **JSONB in `content`**

TypeScript mirrors this exactly as a discriminated union on `section_type`
(`lib/types/pattern.ts`), so the compiler knows which shape you have.

---

## 6. Where Claude gets used

Three separate calls, three different jobs:

| Flow | Route | Input | Model | Shape |
|---|---|---|---|---|
| **Ball-band scan** | `/api/stash/analyze` | Photo of a yarn label | `claude-opus-5` | Sync, seconds |
| **Receipt import** | `/api/stash/receipt` | Receipt PDF or photo, many line items | `claude-opus-5` | Sync, `maxDuration = 60` |
| **Pattern extraction** | `/api/patterns/upload` + `/extract` | Whole pattern PDF | `claude-sonnet-5` | **Async job**, 30–60s |

All three use **structured output schemas** rather than "please return JSON",
so the response is guaranteed parseable.

### Why pattern extraction is a job and the others aren't

Extraction is too slow to hold an HTTP request open, and a page refresh used to
orphan work that was actually succeeding. So it was split in two:

```
Phase 1   POST /api/patterns/upload
          → store PDF in Supabase Storage
          → small, fast Claude call: "what sizes does this pattern offer?"
          → returns the size list

          user picks a size  ← this is the whole point: extracting one size
                               instead of all of them keeps output manageable

Phase 2   POST /api/patterns/upload/extract
          → insert a pattern_jobs row
          → hand the real work to Next's after()
          → return 202 { jobId } immediately

Polling   GET /api/patterns/jobs/[id]  every 2s
          pending → processing → succeeded | failed
```

The client side of this lives in `lib/upload/UploadContext.tsx`, a state machine
of `idle → uploading → selecting_size → extracting → success | error`. The job
id is written to `localStorage`, so **reloading the page rejoins an in-flight
extraction** rather than losing it. `UploadStatusBar` renders the whole thing as
fixed bottom-right feedback, which is why it sits at the layout level and not
inside the upload page.

The worker (`lib/patterns/extract-job.ts`) **never throws** — every failure path
writes to the job row instead, so a polling client always reaches a terminal
state rather than hanging forever.

---

## 7. Yarn search, and why it looks over-engineered

It isn't — every odd choice here is paying off a measured cost.

**Problem 1: there's no brand list.** No `yarn_companies` table, PostgREST has
no `DISTINCT`, and aggregate functions are disabled on this project. So
`lib/yarns/brand-index.ts` sweeps all ~98k yarns once (≈68 paginated requests,
12 at a time), folds them down to ~14.8k distinct brands, and caches that in
memory for 6 hours. Autocomplete only reads the index once it's warm, so a
keystroke never waits on the sweep.

**Problem 2: `ILIKE` is unusably slow here.** Two measurements drove the design:

| Approach | Measured | Used? |
|---|---|---|
| Brand filter via `ILIKE '%…%'` | ~2.2s (leading wildcard → seq scan) | No |
| Brand filter via exact `.in()` against the cached index | ~0.3s | **Yes** |
| Name search via `ILIKE` | ~7.5s | No |
| Name search via `search_vector` + `to_tsquery` prefix (`malab:*`) | ~0.3s | **Yes** |

`lib/yarns/search-query.ts` builds those prefix queries safely — `to_tsquery`
treats `& | ! : ( )` as syntax and errors on raw user input, so terms are
*extracted* with a Unicode regex rather than escaped, capped at 6.

**Problem 3: labels don't match the catalog.** A ball band says "Malabrigo",
the catalog says "Malabrigo Yarn". `lib/yarns/match.ts` normalizes both sides
and matches brands by *containment*, while requiring the yarn name itself to
match outright. If two candidates tie, it returns `null` — the user picks,
rather than silently getting the wrong yarn.

---

## 8. The frontend

```
app/layout.tsx
  └─ AuthProvider            user + session, from Supabase auth
      └─ UploadProvider      the extraction state machine
          ├─ AppShell        sidebar + content well
          │    └─ {page}
          ├─ UploadStatusBar fixed bottom-right progress
          └─ FeedbackButton
```

`AppShell` opts *out* of the chrome for `/` and `/auth/*` — the marketing page
and the login screens render full-bleed with their own headers.

**Page conventions.** Nearly every page is `'use client'` and follows the same
three-state pattern: auth check → loading skeleton → error card → content.
Sidebar collapse state lives in `sidebarState.ts` (a small external store, so it
survives navigation), and `useHydrated` suppresses the transition on first paint
to avoid a visible snap.

**Components.**

```
app/components/
  ui/            Button, Card, Badge, icons — composition via variant/size/className
  navigation/    AppShell, Sidebar
  yarns/         YarnCard, YarnGrid, YarnTable, BrandFilter,
                 SearchAutocomplete, AddYarnDialog, ReceiptImport
  projects/      ProjectCard, ProjectGrid
  feedback/      FeedbackButton
```

There's no `patterns/` folder yet — the pattern reader UI still lives inline in
`app/patterns/[id]/page.tsx`. By convention that's where it would go when it
gets broken up.

**Design system** is Tailwind 4 `@theme` tokens in `globals.css` — a warm
parchment/ink/terracotta palette with sage, sand, honey and clay accents, plus
Figtree (body) and Playfair Display (headings).

---

## 9. Code map — where to look for what

| I want to… | Go to |
|---|---|
| Change who can see what page | `middleware.ts` |
| Add an API endpoint | `app/api/<name>/route.ts` |
| Touch the database from the server | `lib/supabase/server.ts` (user) or `admin.ts` (worker) |
| Change what Claude extracts from a pattern | `lib/patterns/extraction-prompt.ts` |
| Change how a receipt is read | `lib/yarns/receipt-prompt.ts` |
| Change the upload UX / state machine | `lib/upload/UploadContext.tsx` |
| Fix yarn search speed or accuracy | `lib/yarns/{brand-index,search-query,match}.ts` |
| Add a type | `lib/types/{yarn,pattern,project}.ts` → re-exported from `index.ts` |
| Change colors or fonts | `app/globals.css` (`@theme` block) |
| Re-import the Ravelry catalog | `scripts/import-yarns.ts` |

Path alias: `@/*` → project root.

### Every endpoint, in one list

```
GET    /api/yarns                    catalog search — query, weight, brand[], paging
GET    /api/yarns/[id]               one catalog yarn
GET    /api/yarns/brands             brand list for the filter (from the cached index)
GET    /api/yarns/suggest            search-bar autocomplete (brands + yarns)

GET    /api/stash                    your stash
POST   /api/stash                    add a yarn
PUT    /api/stash/[id]               edit a stash yarn  (+ DELETE)
POST   /api/stash/analyze            ball-band photo  → yarn fields
POST   /api/stash/receipt            receipt PDF/photo → many yarn line items

GET    /api/patterns                 your patterns
GET    /api/patterns/[id]            one pattern, fully assembled  (+ DELETE)
GET    /api/patterns/[id]/wip        your progress in that pattern  (+ PUT)
POST   /api/patterns/upload          phase 1: store PDF, detect sizes
POST   /api/patterns/upload/extract  phase 2: queue extraction → 202 { jobId }
GET    /api/patterns/jobs/[id]       poll job status
```

Every one of them: parse → auth check → query → `NextResponse.json()`.
`401` unauthenticated, `400` bad input, `404` missing, `500` unexpected —
always JSON, never a thrown exception escaping as HTML.

---

## 10. Honest current state

Things worth knowing before you make plans:

- **Projects are fake.** `/dashboard` and `/queue` read `mockProjects`. Wiring
  them to the real `projects` table is the biggest gap between what the app
  looks like and what it does.
- **The schema isn't in source control.** Only `010_pattern_jobs.sql` exists as
  a migration; every other table lives only in the hosted database. This is the
  single blocker for local dev — `npm run db:reset` would build a database
  containing just `pattern_jobs`. Fixing it is one `npm run db:pull` plus a
  commit, but it needs a browser login and the DB password.
- **Dev runs against production.** One hosted Supabase project, holding real
  data. Anything destructive (notably pattern delete, which removes storage
  objects) is being exercised against live data until the above is fixed.
- **No tests.** Vitest is the plan. The middleware guard is the obvious first
  target — it's a pure path × cookie-state → redirect table.
- **No CI, no Prettier, no error boundaries.**
- **Login forgets where you were going.** Bounced from `/yarns`, you land on
  `/dashboard` afterwards. A `redirectTo` param would close the loop.

### Before you commit

```bash
npm run lint && npm run typecheck    # always
npm run build                        # the definitive check — if it passes, it ships
```
