-- Follow-up to 20260903120500_fix_schema_drift_produits_banners.sql: that migration used
-- `create table if not exists public.produits`, which silently no-op'd because a legacy
-- `produits` table already existed in production with an incompatible schema
-- (id, created_at, updated_at, name, description, price, pro_id) — a leftover from an earlier
-- prototype, unrelated to the commerce_id/nom/prix/photo_url schema the app code and this
-- repo's migrations actually use. Confirmed empty (0 rows) and referenced by nothing else
-- before dropping.

drop table if exists public.produits;

create table public.produits (
  id uuid primary key default gen_random_uuid(),
  commerce_id uuid not null references public.commerces (id) on delete cascade,
  nom text not null,
  prix numeric,
  description text,
  photo_url text,
  created_at timestamptz not null default now()
);

alter table public.produits enable row level security;

create policy "Lecture publique produits"
on public.produits for select
using (true);

create policy "Un pro ajoute des produits a sa fiche"
on public.produits for insert
to authenticated
with check (
  exists (select 1 from public.commerces c where c.id = commerce_id and c.owner_id = auth.uid())
);

create policy "Un pro supprime ses propres produits"
on public.produits for delete
to authenticated
using (
  exists (select 1 from public.commerces c where c.id = commerce_id and c.owner_id = auth.uid())
);
