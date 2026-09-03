alter table public.commerces
  add column video_url text;

insert into storage.buckets (id, name, public, file_size_limit)
values ('commerce-videos', 'commerce-videos', true, 104857600) -- 100 MB
on conflict (id) do nothing;

create policy "Lecture publique videos commerces"
on storage.objects for select
using (bucket_id = 'commerce-videos');

create policy "Un pro televerse ses videos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'commerce-videos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Un pro remplace ses videos"
on storage.objects for update
to authenticated
using (
  bucket_id = 'commerce-videos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Un pro supprime ses videos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'commerce-videos'
  and (storage.foldername(name))[1] = auth.uid()::text
);
