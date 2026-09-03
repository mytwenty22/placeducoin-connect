-- Production drift fix found during a pre-launch QA audit: the "produits" table and the
-- "banners.position" column exist as tracked migrations in this repo but were never actually
-- applied to the live database (querying either from the app returns a hard error — 404 "table
-- not found" for produits, "column does not exist" for banners.position). This breaks the Pro
-- Catalogue feature and the top/bottom sponsor banner targeting entirely. Written idempotently
-- (IF NOT EXISTS everywhere) so it is safe to run regardless of partial application.

create table if not exists public.produits (
  id uuid primary key default gen_random_uuid(),
  commerce_id uuid not null references public.commerces (id) on delete cascade,
  nom text not null,
  prix numeric,
  description text,
  photo_url text,
  created_at timestamptz not null default now()
);

alter table public.produits enable row level security;

drop policy if exists "Lecture publique produits" on public.produits;
create policy "Lecture publique produits"
on public.produits for select
using (true);

drop policy if exists "Un pro ajoute des produits a sa fiche" on public.produits;
create policy "Un pro ajoute des produits a sa fiche"
on public.produits for insert
to authenticated
with check (
  exists (select 1 from public.commerces c where c.id = commerce_id and c.owner_id = auth.uid())
);

drop policy if exists "Un pro supprime ses propres produits" on public.produits;
create policy "Un pro supprime ses propres produits"
on public.produits for delete
to authenticated
using (
  exists (select 1 from public.commerces c where c.id = commerce_id and c.owner_id = auth.uid())
);

alter table public.banners
  add column if not exists position text not null default 'top' check (position in ('top', 'bottom'));
