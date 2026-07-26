# Supabase

Schema for this project is managed with the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started), pinned as a dev dependency so everyone runs the same version.

```
supabase/
  config.toml     CLI project config (committed)
  migrations/     SQL migrations, applied in filename order (committed)
  .gitignore      ignores .branches/, .temp/ (contains the linked project ref)
```

## ⚠️ Read this first: the schema is not yet captured

The hosted database has been evolving without migration files. `patterns`,
`pattern_details`, `pattern_materials`, `pattern_sections`,
`pattern_instructions`, `pattern_stitch_glossary`, `user_pattern_progress`,
`pattern_notes`, `yarns`, `yarn_fibers`, `yarn_photos`, `stash_yarns`,
`projects`, and `project_yarns` all exist in production, but **none of them are
described anywhere in this repo** — `supabase/migrations/` was empty, and in
fact was never tracked by git at all.

That means the database currently cannot be recreated from source. Before
writing any new migration, capture the existing schema as a baseline (see
below). Until that is done, `db push` has nothing to reconcile against and
`db diff` will report the entire schema as a change.

## One-time setup

```sh
npx supabase login                 # opens a browser; stores a CLI access token
npm run db:link                    # links this checkout to the hosted project
```

`db:link` prompts for the **database password** (Dashboard → Project Settings →
Database). The linked project ref is written to `supabase/.temp/`, which is
gitignored — every developer links their own checkout.

## Capture the existing schema (do this once, before any new migration)

```sh
npm run db:pull                    # writes a baseline migration from the live DB
```

This generates `supabase/migrations/<timestamp>_remote_schema.sql` describing
everything that already exists. Commit it. From then on the repo is the source
of truth and the workflow below applies.

## Day-to-day

**Apply pending migrations to the hosted project:**

```sh
npm run db:push
```

**Write a new migration by hand:**

```sh
npx supabase migration new add_pattern_jobs
# edit supabase/migrations/<timestamp>_add_pattern_jobs.sql
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

## Local Postgres (optional)

`config.toml` also configures a full local Supabase stack via Docker
(`npx supabase start`). Nothing in this project depends on it yet — development
runs against the hosted project — but it is available if you want to test a
migration before pushing it.
