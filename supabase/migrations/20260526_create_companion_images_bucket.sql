insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'companion-images',
  'companion-images',
  true,
  10485760,
  array['image/png']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
