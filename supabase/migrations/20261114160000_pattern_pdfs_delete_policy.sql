-- Let users delete objects in their own folder of the `pattern-pdfs` bucket.
--
-- The bucket had INSERT and SELECT policies but no DELETE policy, so the
-- pattern DELETE route's `storage.remove()` (run on the caller's own client)
-- was silently filtered to zero rows by RLS: the pattern row went away and its
-- PDF stayed in storage forever.
--
-- This mirrors the existing SELECT policy: the first path segment is the
-- owner's user id, which the upload route sets server-side and the extract
-- route verifies. Deleting stays on the user's client rather than the
-- service-role one, so a bad path can never reach another user's files.
--
-- Postgres has no CREATE POLICY IF NOT EXISTS, hence the drop first.

drop policy if exists "Users can delete their own patterns" on storage.objects;

create policy "Users can delete their own patterns"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'pattern-pdfs'
    and (auth.uid())::text = (storage.foldername(name))[1]
  );
