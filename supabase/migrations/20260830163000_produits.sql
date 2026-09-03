-- Catalogue de produits par commerce : ajout manuel ou import CSV depuis l'Espace Pro,
-- affiché sur le site vitrine sur-mesure (/site/:slug).
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
