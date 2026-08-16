-- Tie a stitch counter to the step it belongs to.
--
-- Counters started out pattern-wide, which is right for "total rows" but wrong
-- for the common case: a counter that only means something on one instruction
-- ("decreases worked", "repeats of row 12"). A nullable instruction_id lets
-- both coexist — null keeps the old pattern-wide behaviour, so every counter
-- that already exists stays exactly as it was.
--
-- Mirrors pattern_notes.instruction_id, which links a note to a step the same
-- way.
--
-- ON DELETE SET NULL rather than CASCADE on purpose: re-extracting a pattern
-- replaces its instructions, and losing the count a knitter has been keeping
-- is worse than losing the link. A counter whose step disappears quietly
-- becomes pattern-wide instead of vanishing.

alter table pattern_counters
  add column if not exists instruction_id uuid
    references pattern_instructions (id) on delete set null;

-- The dock asks "which counters belong to this step" on every step change.
create index if not exists pattern_counters_instruction_idx
  on pattern_counters (user_id, pattern_id, instruction_id);
