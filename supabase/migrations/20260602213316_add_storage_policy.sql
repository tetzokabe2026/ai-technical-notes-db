-- Allow public read and anon upload to note-images bucket
insert into storage.buckets (id, name, public)
values ('note-images', 'note-images', true)
on conflict (id) do update set public = true;

create policy "Public read note-images"
  on storage.objects for select
  using (bucket_id = 'note-images');

create policy "Anon upload note-images"
  on storage.objects for insert
  with check (bucket_id = 'note-images');
