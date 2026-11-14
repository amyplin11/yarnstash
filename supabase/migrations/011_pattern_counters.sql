-- Per-pattern stitch counters.
--
-- user_pattern_progress already carries row_counter and repeat_counter, but
-- those are two fixed, unnamed integers. Knitters routinely want several at
-- once — rows in the body, repeats of a lace chart, decreases remaining — and
-- want to name them after whatever they are counting. That is a row per
-- counter, not a column per counter, so counters live in their own table.
--
-- Scoped by (user_id, pattern_id): the same pattern knitted by two users keeps
-- two independent sets of counters.

create table if not exists pattern_counters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  pattern_id uuid not null references patterns (id) on delete cascade,

  name text not null default 'Counter',
  -- Counters run forward from zero; the minus button stops there rather than
  -- going negative, and the API clamps before writing.
  value integer not null default 0 check (value >= 0),
  -- Display order, so a knitter can keep "Rows" above "Repeats".
  position integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pattern_counters_owner_idx
  on pattern_counters (user_id, pattern_id, position);

alter table pattern_counters enable row level security;

create policy pattern_counters_select_own on pattern_counters
  for select using (auth.uid() = user_id);

create policy pattern_counters_insert_own on pattern_counters
  for insert with check (auth.uid() = user_id);

create policy pattern_counters_update_own on pattern_counters
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy pattern_counters_delete_own on pattern_counters
  for delete using (auth.uid() = user_id);

create or replace function set_pattern_counters_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists pattern_counters_updated_at on pattern_counters;
create trigger pattern_counters_updated_at
  before update on pattern_counters
  for each row execute function set_pattern_counters_updated_at();
