-- Alignement de la base de production sur le dépôt, après comparaison complète du 2026-10-28
-- (migrations rejouées sur un Postgres vierge vs catalogue de production). Les écarts venaient
-- d'objets créés ou modifiés hors migrations.

-- 1. Profils : « Users can insert their own profile » (with check auth.uid() = id) laissait un
-- utilisateur créer son propre profil avec n'importe quel rôle, admin compris (aucun trigger ne
-- crée le profil à l'inscription, et enforce_profile_identity ne contrôle le rôle qu'en UPDATE).
-- Les deux autres « Users can … » doublonnaient des policies existantes. La création de profil
-- reste limitée aux rôles pro et association ; la modification du profil pro, absente en
-- production, est recréée (nécessaire à l'upsert de l'inscription Pro).
drop policy if exists "Users can insert their own profile" on public.profiles;
drop policy if exists "Users can update their own profile" on public.profiles;
drop policy if exists "Users can view own profile" on public.profiles;

drop policy if exists "Un utilisateur crée son profil Pro" on public.profiles;
drop policy if exists "Un utilisateur cree son propre profil pro" on public.profiles;
create policy "Un utilisateur cree son propre profil pro"
on public.profiles for insert
to authenticated
with check (id = auth.uid() and role = 'pro');

drop policy if exists "Un utilisateur modifie son propre profil pro" on public.profiles;
create policy "Un utilisateur modifie son propre profil pro"
on public.profiles for update
to authenticated
using (id = auth.uid() and role = 'pro')
with check (id = auth.uid() and role = 'pro');

-- 2. Produits : le prix est facultatif (« Prix non renseigné ») ; en production il était NOT NULL,
-- ce qui faisait échouer tout ajout sans prix, manuel ou par import CSV.
alter table public.produits alter column prix drop not null;

-- 3. Bannières : sans ces policies, l'annulation d'une réservation par le pro ne modifiait aucune
-- ligne, sans erreur, alors que l'interface la disait annulée. enforce_banner_owner_update limite
-- toujours la modification à active -> false.
drop policy if exists "Un pro met a jour sa propre reservation" on public.banners;
create policy "Un pro met a jour sa propre reservation"
on public.banners for update
to authenticated
using (exists (select 1 from public.commerces c where c.id = commerce_id and c.owner_id = auth.uid()))
with check (exists (select 1 from public.commerces c where c.id = commerce_id and c.owner_id = auth.uid()));

drop policy if exists "Un pro annule sa propre reservation" on public.banners;
create policy "Un pro annule sa propre reservation"
on public.banners for delete
to authenticated
using (exists (select 1 from public.commerces c where c.id = commerce_id and c.owner_id = auth.uid()));

-- La suppression d'une fiche supprime ses bannières (ON DELETE SET NULL en production).
alter table public.banners drop constraint if exists banners_commerce_id_fkey;
alter table public.banners
  add constraint banners_commerce_id_fkey
  foreign key (commerce_id) references public.commerces (id) on delete cascade;

-- 4. Contraintes de validation absentes en production (données actuelles conformes).
alter table public.commerces drop constraint if exists commerces_category_check;
alter table public.commerces
  add constraint commerces_category_check
  check (category in ('bouche', 'services', 'boutiques', 'locale'));

alter table public.banners drop constraint if exists banners_position_check;
alter table public.banners
  add constraint banners_position_check check (position in ('top', 'bottom'));

alter table public.banners drop constraint if exists banners_tier_check;
alter table public.banners
  add constraint banners_tier_check check (tier in ('test', 'standard', 'exclusif'));

-- 5. Index des statistiques par commerce.
create index if not exists commerce_stats_events_commerce_id_idx
  on public.commerce_stats_events (commerce_id);

-- 6. Règles des associations : version du dépôt (security definer, search_path figé) et noms de
-- triggers du dépôt (tr_* en production).
create or replace function public.enforce_association_commerce_category()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.profiles p where p.id = new.owner_id and p.role = 'association'
  ) then
    new.category := 'locale';
  end if;
  return new;
end;
$$;

drop trigger if exists tr_enforce_association_commerce_category on public.commerces;
drop trigger if exists trg_enforce_association_commerce_category on public.commerces;
create trigger trg_enforce_association_commerce_category
before insert or update on public.commerces
for each row execute function public.enforce_association_commerce_category();

create or replace function public.enforce_association_promo_kind()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.commerces c
    join public.profiles p on p.id = c.owner_id
    where c.id = new.commerce_id and p.role = 'association'
  ) then
    new.kind := 'evenement';
  end if;
  return new;
end;
$$;

drop trigger if exists tr_enforce_association_promo_kind on public.promos;
drop trigger if exists trg_enforce_association_promo_kind on public.promos;
create trigger trg_enforce_association_promo_kind
before insert or update on public.promos
for each row execute function public.enforce_association_promo_kind();
