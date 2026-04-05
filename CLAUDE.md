# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

YarnStash is a knitting project manager built with Next.js 16 (App Router), Supabase, and Tailwind CSS 4. It lets users manage their yarn stash, track knitting projects, browse a global yarn catalog (imported from Ravelry), and upload knitting pattern PDFs for AI-powered extraction.

## Commands

- `npm run dev` — Start dev server (Next.js)
- `npm run build` — Production build
- `npm run lint` — ESLint (flat config, next/core-web-vitals + typescript)
- `npm run typecheck` — Run `tsc --noEmit` (check types without building)
- `npm run import:yarns` — Import yarns from Ravelry API into Supabase
- `npm run import:yarns:resume` — Resume a previously interrupted import

### Validation workflow

Always run before committing: `npm run lint && npm run typecheck`. The build (`npm run build`) is the definitive check — if it passes, the code is shippable. No test framework is configured yet (Vitest is planned).

## Architecture

### Data layer: two kinds of Supabase clients

- `lib/supabase/client.ts` — Browser client (uses cookie-based auth storage). Import the singleton `supabase`.
- `lib/supabase/server.ts` — Server-side client (reads auth from `next/headers` cookies). Call `createServerClient()` in API routes and server components.
- The import script (`scripts/import-yarns.ts`) uses a separate admin client with `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS.

### Database tables (Supabase)

**User-scoped (RLS by `user_id`):** `stash_yarns`, `projects`, `project_yarns`, `patterns`, `pattern_details`, `pattern_materials`, `pattern_sections`, `pattern_instructions`, `pattern_stitch_glossary`, `user_pattern_progress`, `pattern_notes`

**Global (read-only for authenticated users):** `yarns`, `yarn_fibers`, `yarn_photos` — populated via the Ravelry import script. The `yarns` table has a `search_vector` tsvector column for full-text search and a `raw_data` JSONB column with the complete Ravelry API response.

Migrations are in `supabase/migrations/` (numbered sequentially).

### API routes (`app/api/`)

- `/api/yarns` — Search the global yarn catalog (full-text search, weight/brand filters, pagination)
- `/api/yarns/[id]` — Single yarn detail
- `/api/stash` — CRUD for user's personal yarn stash (auth required)
- `/api/stash/[id]` — Single stash yarn
- `/api/patterns` — User's patterns
- `/api/patterns/upload` — PDF upload → Claude API extracts structured pattern data → stores in Supabase
- `/api/ravelry/yarns`, `/api/ravelry/patterns` — Proxy to Ravelry API

### Context providers

Layout wraps the app in a provider hierarchy: `AuthProvider` → `UploadProvider` → Navbar + children + `UploadStatusBar`. The upload flow uses `useUpload()` hook (from `lib/upload/UploadContext.tsx`) to manage file validation, POST to `/api/patterns/upload`, and status transitions (`idle` → `uploading` → `success`/`error`). The `UploadStatusBar` component renders fixed bottom-right feedback based on this state.

### Pattern PDF extraction

`app/api/patterns/upload/route.ts` sends uploaded PDFs to the Anthropic API (Claude Sonnet 4) for structured extraction. The response is parsed as `ExtractedPatternData` and decomposed across multiple tables (pattern_details, pattern_materials, pattern_sections, pattern_instructions, pattern_stitch_glossary).

**Section content polymorphism:** Sections use a `section_type` discriminator. `written_instructions` sections store rows in the `pattern_instructions` table; other types (`chart`, `stitch_pattern`, `schematic`, `notes`) store data as JSONB in the `content` column of `pattern_sections`. The TypeScript types mirror this with a discriminated union on `section_type`.

### Type system

Types are in `lib/types/` and re-exported from `lib/types/index.ts`:
- `yarn.ts` — `Yarn` (UI), `CatalogYarn` (DB/Ravelry), `StashYarn`, plus `catalogYarnToYarn()` converter
- `pattern.ts` — Full pattern model with `ExtractedPatternData` (Claude API response shape) and sections as a discriminated union on `section_type`
- `project.ts` — `Project`, `YarnInProject`

### Component conventions

- All user-facing pages are `'use client'` components
- UI primitives (`Button`, `Card`, `Badge` in `app/components/ui/`) use composition with `variant`/`size`/`className` props
- Pages follow a consistent pattern: auth check → loading skeleton → error card → content
- New components go in `app/components/<domain>/` (e.g., `yarns/`, `patterns/`). Shared UI primitives go in `app/components/ui/`.

### Auth

`lib/auth/AuthContext.tsx` provides `AuthProvider` and `useAuth()` hook. Wraps the entire app in `layout.tsx`. Uses Supabase email/password auth.

**No middleware.ts exists yet.** Route protection is currently client-side only (pages check auth and redirect). A Next.js middleware for server-side auth guard is a planned improvement.

### Environment variables

Required in `.env.local` (see `.env.example` for the template):
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — Supabase client
- `SUPABASE_SERVICE_ROLE_KEY` — Admin access for import scripts
- `ANTHROPIC_API_KEY` — Pattern PDF extraction
- `RAVELRY_USERNAME`, `RAVELRY_PASSWORD` — Ravelry API (Basic Auth)

### Path alias

`@/*` maps to the project root (configured in `tsconfig.json`).

### Yarn import script

`scripts/import-yarns.ts` fetches yarns from the Ravelry API segmented by weight category, with resume support via `.import-progress.json`. It handles rate limiting (429 retry), upserts yarns/fibers/photos, and uses the `SUPABASE_SERVICE_ROLE_KEY` admin client to bypass RLS.

## Coding Conventions

### Naming

- Files/directories: `kebab-case` for routes, `PascalCase` for components (e.g., `YarnCard.tsx`)
- Types/interfaces: `PascalCase` (`CatalogYarn`, `ExtractedPatternData`)
- Functions/variables: `camelCase`
- Database columns: `snake_case` (Supabase/Postgres convention)

### API route patterns

All API routes in `app/api/` follow this structure:
1. Parse request (searchParams for GET, body for POST/PUT/DELETE)
2. Auth check via `createServerClient()` + `supabase.auth.getUser()` for user-scoped routes
3. Database operation
4. Return `NextResponse.json()` with appropriate status codes

Return `401` for unauthenticated, `400` for bad input, `404` for missing resources, `500` for unexpected errors. Always return JSON, never throw unhandled.

### Database / migrations

- Migrations are numbered sequentially: `001_`, `002_`, etc.
- New migrations should be additive (add columns/tables, don't drop/rename existing ones in production)
- All user-scoped tables must have RLS policies enforcing `auth.uid() = user_id`
- Use `ON CONFLICT ... DO UPDATE` (upsert) for idempotent imports

### Error handling

- API routes: catch errors and return JSON error responses, never let exceptions propagate as HTML
- Client pages: use the loading/error/content pattern — show a skeleton while loading, an error card on failure
- Supabase calls: always check `{ data, error }` — Supabase client never throws, it returns errors in the response object

## Known Gaps / Planned Improvements

These are documented so Claude knows the current state and can suggest or implement them when relevant:

- **No middleware.ts** — Auth is client-side only; needs server-side route protection
- **No test framework** — Vitest is the planned choice (fast, ESM-native, works well with Next.js)
- **No CI/CD** — No GitHub Actions; lint + typecheck + build should run on PRs
- **No Prettier** — Only ESLint; formatting is not enforced
- **No error boundaries** — No React error boundary components for graceful crash recovery
- **No Supabase local dev** — No `supabase/config.toml` or local Supabase instance; development runs against the hosted project
