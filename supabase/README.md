# Supabase

Schema for this project is managed with the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started), pinned as a dev dependency so everyone runs the same version.

```
supabase/
  config.toml     CLI project config (committed)
  migrations/     SQL migrations, applied in filename order (committed)
  seed.sql        generated dev fixture, loaded on `db reset` (committed)
  .gitignore      ignores .branches/, .temp/ (contains the linked project ref)
```

## Environments

| | Hosted project | Local stack |
|---|---|---|
| Command | `npm run db:link` | `npm run db:start` |
| Where | Supabase cloud | Docker, on your machine |
| Data | real catalog + real user data | `seed.sql`, ~300 yarns |
| Resettable | no | `npm run db:reset`, seconds |
| Cost | shared with production | free |

There is **one hosted project**, and it is production. Pointing `.env.local` at
it means developing against live data — including the pattern delete path in
`app/api/patterns/[id]/route.ts`, which removes objects from the `pattern-pdfs`
storage bucket with no undo. The local stack exists so that iterating on
anything destructive does not have to happen there.

A second *hosted* project was considered and deliberately not adopted: free-tier
projects pause after about a week idle, and a second live database with no CI
generates schema drift faster than it prevents accidents. The local stack gives
the same Postgres 17, RLS, storage and auth for free.

## ⚠️ Read this first: the schema is still not captured

The hosted database has been evolving without migration files. `patterns`,
`pattern_details`, `pattern_materials`, `pattern_sections`,
`pattern_instructions`, `pattern_stitch_glossary`, `user_pattern_progress`,
`pattern_notes`, `yarns`, `yarn_fibers`, `yarn_photos`, `stash_yarns`,
`projects`, and `project_yarns` all exist in production, but **none of them are
described anywhere in this repo** — only `010_pattern_jobs.sql` is.

That means the database cannot yet be recreated from source, and so **the local
stack does not work yet**: `db reset` would build a database containing
`pattern_jobs` and nothing else, and `seed.sql` would fail against it because
`yarns` would not exist.

Capturing the baseline is the one prerequisite. It needs two things only a
human can supply — a browser login and the database password — which is why it
is not already done:

```sh
npx supabase login                 # opens a browser; stores a CLI access token
npm run db:link                    # prompts for the database password
npm run db:pull                    # writes supabase/migrations/<ts>_remote_schema.sql
```

Commit the generated migration. From that point the repo is the source of truth
and everything below works.

`db:link` targets the production ref by default. Override it to point a checkout
somewhere else:

```sh
SUPABASE_PROJECT_REF=abcdefghijklmnop npm run db:link
```

The linked ref is written to `supabase/.temp/`, which is gitignored — every
developer links their own checkout.

## Local development (after the baseline exists)

```sh
npm run db:start                   # boots Postgres, auth, storage in Docker
npm run db:reset                   # migrations, then seed.sql
```

Copy the URL and keys `db:start` prints into `.env.local` (see `.env.example`).
`npm run db:status` reprints them. To go back to the hosted project, restore the
hosted values; `npm run db:stop` shuts the containers down.

Requires Docker to be installed and running.

### Seed data

`seed.sql` is generated, not hand-written. The real catalog is ~98k yarns,
~178k fiber rows and ~275k photo rows imported from Ravelry over a slow,
rate-limited run — far too much to carry in the repo or re-import per reset.

```sh
npm run db:seed:generate           # 25 yarns per weight (~300 total)
npm run db:seed:generate -- --per-weight=50
```

The script samples evenly across all twelve weight categories so the weight
filter and full-text search on `/yarns` have something to work against; a naive
`limit 300` would return Fingering yarns only. It reads from whatever
`.env.local` points at, so run it against the hosted project.

`search_vector` is left out and repopulated by the database on insert.
`raw_data` is written as `{}` — it is never read by the app and carrying it
would multiply the file size. Photos are capped at two per yarn for the same
reason.

Seeding covers the global catalog only. User-scoped tables start empty; sign up
through the app to create a local account.

## Day-to-day

**Apply pending migrations to the hosted project:**

```sh
npm run db:push
```

**Write a new migration by hand:**

```sh
npx supabase migration new add_pattern_jobs
# edit supabase/migrations/<timestamp>_add_pattern_jobs.sql
npm run db:reset                   # verify locally first
npm run db:push
```

**Or generate one from changes made in the dashboard:**

```sh
npm run db:diff -- add_pattern_jobs   # note the `--`, since db:diff ends in -f
```

**See what is applied where:**

```sh
npm run db:migrations              # local vs remote, side by side
```

## Conventions

- Migrations are **additive**. Add columns and tables; don't drop or rename
  existing ones in production.
- Every user-scoped table needs RLS enforcing `auth.uid() = user_id`.
- Use `create table if not exists` and `ON CONFLICT ... DO UPDATE` so
  migrations and imports are idempotent.
- The CLI names migrations with a UTC timestamp prefix
  (`20260726123045_name.sql`), which is why they sort correctly. Historical
  files in this project used a sequential `010_` prefix; prefer the CLI's
  timestamps for anything new, so ordering stays unambiguous when two people
  add migrations at once.
- `npm run db:reset` only ever touches the local stack. Resetting the hosted
  database requires an explicit `--linked`, which no script here passes.
