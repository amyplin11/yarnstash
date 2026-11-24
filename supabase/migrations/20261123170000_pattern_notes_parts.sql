-- Notes on any part of a pattern, per size, shared across copies of one PDF.
--
-- pattern_notes predates migration tracking. It already existed in production
-- (empty, unused) with: id, user_id, pattern_id, instruction_id → cascade,
-- note_text, note_type, is_pinned, created_at, updated_at, owner-only RLS for
-- select/insert/update/delete, and an updated_at trigger. This file extends it.
--
-- What a note is attached to — at most one of these is set; none means the note
-- is about the whole pattern:
--   instruction_id  one step (pre-existing column)
--   section_id      one section
--   material_id     one yarn in the materials list
--   anchor          a block with no row of its own: 'gauge', 'needles' or
--                   'notions' live as JSON inside pattern_details
--
-- size: the size being knit when the note was written. One note per part per
-- size, so a knitter who makes the S and then the M keeps both.
--
-- part_key: a description of the part that does not depend on row ids, e.g.
-- 'needles', 'section:body#1', 'step:body#1/12'. A pattern extracted for one
-- size is its own `patterns` row with its own section and step ids, so knitting
-- a second size means a second upload. part_key is how a note written on one
-- copy is found on the other. Computed server-side by lib/patterns/note-parts.ts.
--
-- part_label: how the part read when the note was written ("Body · Step 12"),
-- so a note from another copy can still be shown when its part has no match.

alter table pattern_notes
  add column if not exists size text,
  add column if not exists section_id uuid references pattern_sections (id) on delete cascade,
  add column if not exists material_id uuid references pattern_materials (id) on delete cascade,
  add column if not exists anchor text,
  add column if not exists part_key text,
  add column if not exists part_label text;

-- The table was empty when this ran, so these can be tightened in place.
alter table pattern_notes
  alter column user_id set not null,
  alter column pattern_id set not null,
  alter column part_key set not null;

alter table pattern_notes
  add constraint pattern_notes_anchor_check
    check (anchor in ('gauge', 'needles', 'notions'));

alter table pattern_notes
  add constraint pattern_notes_one_target
    check (num_nonnulls(instruction_id, section_id, material_id, anchor) <= 1);

-- One note per part per size. NULLS NOT DISTINCT so "no size chosen" is one
-- slot too, rather than allowing unlimited duplicates.
create unique index if not exists pattern_notes_one_per_part
  on pattern_notes (user_id, pattern_id, size, part_key) nulls not distinct;

create index if not exists idx_pattern_notes_section_id on pattern_notes (section_id);
create index if not exists idx_pattern_notes_material_id on pattern_notes (material_id);

-- Fingerprint of the uploaded PDF. Two uploads of the same file share it, which
-- is what links an S copy of a pattern to its M copy. Set by the extraction
-- worker from the bytes it downloads; null for patterns uploaded before this.
alter table patterns
  add column if not exists pdf_sha256 text;

create index if not exists idx_patterns_user_pdf_sha256 on patterns (user_id, pdf_sha256);
