-- What the knitter actually used, on the parts of a pattern where that is a
-- question with an answer: the gauge they got, the needles they used, the yarn
-- they substituted. The pattern's own values stay in pattern_details /
-- pattern_materials; this is the knitter's side of the comparison.
--
-- A JSON object rather than columns, because each kind of part asks for
-- different fields. Its shape is set and validated by
-- lib/patterns/note-used.ts:
--   gauge    { "kind": "gauge", "stitches", "rows", "needle" }
--   needles  { "kind": "needles", "needles": [{ "size", "usedFor" }] }
--   yarn     { "kind": "yarn", "yarn", "colorway", "balls" }
-- All fields are optional; balls is a number (halves allowed), the rest
-- strings. note_text still holds the free-text note alongside it; a row may
-- have either or both.

alter table pattern_notes
  add column if not exists used jsonb;

alter table pattern_notes
  add constraint pattern_notes_used_is_object
    check (used is null or jsonb_typeof(used) = 'object');
