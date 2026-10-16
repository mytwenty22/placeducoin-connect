-- Villes et quartiers gérés en autonomie à partir du code postal.
--
-- 1. villes reçoit son code INSEE (identifiant officiel, unique : deux communes homonymes ne se
--    confondent plus) et ses codes postaux. Une ville n'est jamais créée directement par un
--    client : la fonction supabase/functions/ensure-ville la crée (service_role) après avoir
--    vérifié la commune auprès de geo.api.gouv.fr.
-- 2. Nouvelle table quartiers, rattachée à une ville ET à un de ses codes postaux. Lecture
--    publique ; création par un compte pro/association via public.add_quartier, qui dédoublonne
--    ("Les Chartrons" = "les chartrons" = "Les Chârtrons") et limite à 10 créations par compte.
-- 3. commerces.quartier_id (facultatif), contrôlé pour appartenir à la ville de la fiche.

alter table public.villes add column if not exists insee_code text;
alter table public.villes add column if not exists codes_postaux text[] not null default '{}';

create unique index if not exists villes_insee_code_key on public.villes (insee_code);

update public.villes
set insee_code = '33090', codes_postaux = array['33610']
where slug = 'canejan' and insee_code is null;

create or replace function public.quartier_slug(value text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(
    translate(lower(value), 'àâäáãåçéèêëíìîïñóòôöõúùûüýÿœæ', 'aaaaaaceeeeiiiinooooouuuuyyoa'),
    '[^a-z0-9]+', '-', 'g'
  ));
$$;

create table if not exists public.quartiers (
  id uuid primary key default gen_random_uuid(),
  ville_id uuid not null references public.villes (id) on delete cascade,
  code_postal text not null check (code_postal ~ '^\d{5}$'),
  nom text not null check (char_length(nom) between 2 and 60),
  slug text not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (ville_id, slug)
);

create index if not exists quartiers_ville_postal_idx on public.quartiers (ville_id, code_postal);

alter table public.quartiers enable row level security;

drop policy if exists "Lecture publique quartiers" on public.quartiers;
create policy "Lecture publique quartiers"
on public.quartiers for select
using (true);

-- Pas de policy insert/update pour les utilisateurs : la création passe par add_quartier.
drop policy if exists "Admin gere les quartiers" on public.quartiers;
create policy "Admin gere les quartiers"
on public.quartiers for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.add_quartier(p_ville_id uuid, p_code_postal text, p_nom text)
returns public.quartiers
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_nom text := btrim(regexp_replace(coalesce(p_nom, ''), '\s+', ' ', 'g'));
  clean_slug text := public.quartier_slug(clean_nom);
  result public.quartiers;
begin
  if auth.uid() is null or not exists (
    select 1 from public.profiles where id = auth.uid() and role in ('pro', 'association', 'admin')
  ) then
    raise exception 'Réservé aux comptes Pro et Association.' using errcode = '42501';
  end if;

  if char_length(clean_nom) < 2 or char_length(clean_nom) > 60 or clean_slug = '' then
    raise exception 'Nom de quartier invalide (2 à 60 caractères).' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.villes where id = p_ville_id and p_code_postal = any (codes_postaux)
  ) then
    raise exception 'Ce code postal ne correspond pas à cette ville.' using errcode = '22023';
  end if;

  select * into result from public.quartiers where ville_id = p_ville_id and slug = clean_slug;
  if found then
    return result;
  end if;

  if (select count(*) from public.quartiers where created_by = auth.uid()) >= 10
    and not public.is_admin() then
    raise exception 'Limite de 10 quartiers créés par compte atteinte.' using errcode = '42501';
  end if;

  insert into public.quartiers (ville_id, code_postal, nom, slug, created_by)
  values (p_ville_id, p_code_postal, clean_nom, clean_slug, auth.uid())
  on conflict (ville_id, slug) do update set nom = public.quartiers.nom
  returning * into result;
  return result;
end;
$$;

revoke all on function public.add_quartier(uuid, text, text) from public, anon;
grant execute on function public.add_quartier(uuid, text, text) to authenticated;

alter table public.commerces
  add column if not exists quartier_id uuid references public.quartiers (id) on delete set null;

create index if not exists commerces_quartier_idx on public.commerces (quartier_id);

create or replace function public.enforce_commerce_quartier()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.quartier_id is not null and not exists (
    select 1 from public.quartiers where id = new.quartier_id and ville_id = new.ville_id
  ) then
    raise exception 'Ce quartier n''appartient pas à la ville de la fiche.' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_commerce_quartier on public.commerces;
create trigger trg_enforce_commerce_quartier
before insert or update of quartier_id, ville_id on public.commerces
for each row execute function public.enforce_commerce_quartier();
