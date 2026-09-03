-- Compte Pro : un utilisateur peut créer son propre profil, uniquement avec le rôle 'pro'.
-- Les rôles mairie/admin restent exclusivement provisionnés côté serveur (clé service_role),
-- cette policy ne permet donc jamais une auto-promotion vers un rôle privilégié.
create policy "Un utilisateur crée son profil Pro"
on public.profiles for insert
to authenticated
with check (id = auth.uid() and role = 'pro');

-- Une fiche commerce par compte Pro, rattachée à une ville
create table public.commerces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users (id) on delete cascade,
  ville_id uuid not null references public.villes (id),
  slug text not null unique,
  nom text not null,
  trade text not null,
  category text not null check (category in ('bouche', 'services', 'boutiques')),
  adresse text,
  telephone text,
  created_at timestamptz not null default now()
);

alter table public.commerces enable row level security;

create policy "Lecture publique commerces"
on public.commerces for select
using (true);

create policy "Un pro crée sa fiche commerce"
on public.commerces for insert
to authenticated
with check (
  owner_id = auth.uid()
  and exists (select 1 from public.profiles where id = auth.uid() and role = 'pro')
);

create policy "Un pro modifie sa fiche commerce"
on public.commerces for update
to authenticated
using (owner_id = auth.uid());

-- La table promos existait déjà (migration create_base_schema) mais sans lien réel vers
-- une fiche commerce ni RLS. On complète : FK, type d'offre, et policies de propriété.
alter table public.promos
  add constraint promos_commerce_id_fkey foreign key (commerce_id) references public.commerces (id) on delete cascade;

alter table public.promos
  add column kind text not null default 'promo' check (kind in ('promo', 'arrivage'));

alter table public.promos enable row level security;

create policy "Lecture publique promos"
on public.promos for select
using (true);

create policy "Un pro publie une promo pour sa fiche"
on public.promos for insert
to authenticated
with check (
  exists (select 1 from public.commerces c where c.id = commerce_id and c.owner_id = auth.uid())
);

create policy "Un pro supprime ses propres promos"
on public.promos for delete
to authenticated
using (
  exists (select 1 from public.commerces c where c.id = commerce_id and c.owner_id = auth.uid())
);
