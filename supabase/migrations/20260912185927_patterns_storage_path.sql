-- Store the pattern PDF's storage path, not its public URL.
--
-- The `pattern-pdfs` bucket was public, so `patterns.pdf_url` held a
-- permanently valid, unauthenticated link — the URL *was* the permission.
-- The bucket is now private and reads go through GET /api/patterns/[id]/pdf,
-- which checks the session and mints a short-lived signed URL.
--
-- That route needs the object's path. Deriving it from `pdf_url` by splitting
-- on the user id (what the delete route used to do) breaks if a filename ever
-- contains that uuid, so keep the path as its own column.
--
-- `pdf_url` is deliberately left in place: dropping a column in production is
-- not additive, and the stale value is harmless once nothing reads it.

alter table patterns
  add column if not exists storage_path text;

comment on column patterns.storage_path is
  'Object path within the pattern-pdfs bucket, e.g. <user_id>/<ts>-<file>.pdf. '
  'Source of truth for reads and deletes; pdf_url is a legacy public URL.';

-- Backfill from the existing public URLs, which all have the shape
-- https://<ref>.supabase.co/storage/v1/object/public/pattern-pdfs/<path>
--
-- ⚠️ Apply this file with the Supabase CLI, or by running each statement
-- separately. Pasting it whole into the dashboard SQL editor fails with
-- `42703: column "storage_path" does not exist`: the editor does not
-- necessarily execute the ALTER above before parsing this UPDATE.
update patterns
   set storage_path = split_part(pdf_url, '/pattern-pdfs/', 2)
 where storage_path is null
   and pdf_url like '%/pattern-pdfs/%';

-- Close the bucket. Until now this was `public = true`, which serves
-- /storage/v1/object/public/pattern-pdfs/<path> to anyone, without auth and
-- without consulting the owner-scoped RLS policies on storage.objects.
--
-- Bucket config is not normally schema, but it is captured here because it is
-- load-bearing for access control and is otherwise recorded nowhere in source.
-- Deploy this together with the route that signs URLs: flipping it alone breaks
-- every existing "View PDF" link.
update storage.buckets
   set public = false
 where id = 'pattern-pdfs';
