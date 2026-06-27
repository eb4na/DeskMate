-- Make the `companion-images` storage bucket private.
--
-- The bucket was created public (20260526_create_companion_images_bucket.sql) for the
-- AI companion image-generation feature. That feature has been removed from the app and
-- nothing references the bucket anymore (src/lib/ai-companion.ts is dead, no saved state
-- points at it). A public bucket lets anyone with a URL fetch its objects, so flip it to
-- private now that it serves no live purpose. (Reversible — set public=true to undo.
-- The objects/images are low-sensitivity cartoon art, not PII.)
--
-- Run in Supabase (SQL editor, service role). Safe to re-run.

update storage.buckets set public = false where id = 'companion-images';
