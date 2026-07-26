-- Pattern extraction jobs.
--
-- Extraction takes 30-60s, which is too long to hold an HTTP request open.
-- The upload route now records a job row and returns 202 immediately; the
-- extraction runs in the background and reports terminal state here. The
-- client polls this table (via /api/patterns/jobs/[id]) instead of waiting on
-- an open connection, so a page refresh no longer orphans in-flight work.

create table if not exists pattern_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  status text not null default 'pending'
    check (status in ('pending', 'processing', 'succeeded', 'failed')),

  -- Inputs, so the job is self-contained and re-runnable.
  storage_path text not null,
  file_name text not null,
  selected_size text,

  -- Outputs.
  pattern_id uuid references patterns (id) on delete set null,
  -- Denormalised so the polling client can show a name without a second query.
  pattern_name text,
  error text,
  warnings jsonb,
  -- Coarse progress for UI, e.g. {"sections_extracted": 4, "chars": 18342}
  progress jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create index if not exists pattern_jobs_user_created_idx
  on pattern_jobs (user_id, created_at desc);

-- Used to find jobs stranded by a function timeout or a deploy mid-run.
create index if not exists pattern_jobs_active_idx
  on pattern_jobs (status, started_at)
  where status in ('pending', 'processing');

alter table pattern_jobs enable row level security;

-- Users read their own jobs. Writes are performed by the background worker
-- using the service-role key, which bypasses RLS, so no insert/update policy
-- is granted to end users.
create policy pattern_jobs_select_own on pattern_jobs
  for select using (auth.uid() = user_id);

create or replace function set_pattern_jobs_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pattern_jobs_updated_at on pattern_jobs;
create trigger pattern_jobs_updated_at
  before update on pattern_jobs
  for each row execute function set_pattern_jobs_updated_at();
