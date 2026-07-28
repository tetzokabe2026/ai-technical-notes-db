-- Remove anonymous upload policy from note-images bucket.
-- All storage operations go through service_role (which bypasses RLS),
-- so removing this policy has no effect on app functionality.
drop policy if exists "Anon upload note-images" on storage.objects;
