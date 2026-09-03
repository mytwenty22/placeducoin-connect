-- Rôles applicatifs
create type public.app_role as enum ('mairie', 'pro', 'admin');

-- Villes couvertes par la plateforme
create table public.villes (
  id uuid primary key default gen_random_uuid(),
  nom text not null,
  slug text not null unique
);

-- Profil lié à chaque compte auth.users : rôle + ville de rattachement
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null default 'pro',
  ville_id uuid references public.villes (id),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Un utilisateur lit son propre profil"
on public.profiles for select
to authenticated
using (id = auth.uid());

-- Promos commerçants
create table public.promos (
  id uuid primary key default gen_random_uuid(),
  commerce_id uuid not null,
  titre text not null,
  prix_avant numeric,
  prix_maintenant numeric,
  valide_jusqu_a timestamptz not null,
  created_at timestamptz not null default now()
);

-- Vue pratique pour ne récupérer que les promos non expirées (point 4)
create or replace view public.promos_actives as
  select * from public.promos where valide_jusqu_a > now();

-- Publications officielles Mairie, une par ville
create table public."Infos_Mairie" (
  id uuid primary key default gen_random_uuid(),
  ville_id uuid not null references public.villes (id),
  titre text not null,
  corps text,
  type text not null check (type in ('Événement', 'Travaux', 'Information')),
  date_info text,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

alter table public."Infos_Mairie" enable row level security;

-- Lecture publique : tout visiteur voit les infos de toutes les villes
create policy "Lecture publique Infos_Mairie"
on public."Infos_Mairie" for select
using (true);

-- Publication gratuite réservée aux comptes Mairie, uniquement pour leur propre ville (point 5)
create policy "Mairie publie gratuitement dans sa ville"
on public."Infos_Mairie" for insert
to authenticated
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'mairie'
      and p.ville_id = "Infos_Mairie".ville_id
  )
);

create policy "Mairie modifie ses propres publications"
on public."Infos_Mairie" for update
to authenticated
using (
  created_by = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'mairie'
  )
);

create policy "Mairie supprime ses propres publications"
on public."Infos_Mairie" for delete
to authenticated
using (
  created_by = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'mairie'
  )
);
