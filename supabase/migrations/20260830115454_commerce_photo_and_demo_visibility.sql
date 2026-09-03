alter table public.commerces
  add column photo_url text,
  add column site_actif boolean not null default false,
  add column boost_actif boolean not null default false;

-- Bucket public pour les photos de commerce, un dossier par compte Pro (owner_id/fichier)
insert into storage.buckets (id, name, public)
values ('commerce-photos', 'commerce-photos', true)
on conflict (id) do nothing;

create policy "Lecture publique photos commerces"
on storage.objects for select
using (bucket_id = 'commerce-photos');

create policy "Un pro televerse ses photos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'commerce-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Un pro remplace ses photos"
on storage.objects for update
to authenticated
using (
  bucket_id = 'commerce-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Un pro supprime ses photos"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'commerce-photos'
  and (storage.foldername(name))[1] = auth.uid()::text
);
