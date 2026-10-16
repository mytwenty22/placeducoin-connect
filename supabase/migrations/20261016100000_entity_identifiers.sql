-- Politique Freemium + identifiants légaux (SIRET / RNA).
--
-- 1. profiles reçoit le type d'entité ('company' / 'association'), le SIRET, le RNA, la case
--    "En cours d'immatriculation" et un statut de vérification. entity_type est toujours déduit
--    du rôle ('pro' -> 'company', 'association' -> 'association') par trigger, jamais saisi.
-- 2. Le statut de vérification n'est pas modifiable par l'utilisateur : toute modification de
--    SIRET/RNA le repasse en 'a_verifier', et seuls l'admin, le service_role ou le SQL editor
--    peuvent le passer à 'verifie' / 'refuse'.
-- 3. Une association n'a jamais pu créer ni modifier son propre profil (les policies existantes
--    verrouillent role = 'pro') : on ajoute les policies équivalentes pour role = 'association',
--    sans permettre de changer de rôle après coup (bloqué par le trigger).
-- 4. Une association ne peut créer sa fiche (gratuite) qu'une fois un RNA ou un SIRET renseigné.
--    Une entreprise peut créer sa fiche sans SIRET ; le SIRET est exigé au paiement, dans
--    supabase/functions/create-checkout-session.

alter table public.profiles
  add column if not exists entity_type text,
  add column if not exists siret text,
  add column if not exists rna text,
  add column if not exists immatriculation_en_cours boolean not null default false,
  add column if not exists verification_status text not null default 'non_renseigne',
  add column if not exists verified_at timestamptz;

-- Même règle que isValidSiret dans src/lib/entity-id.ts : 14 chiffres + clé de Luhn, avec
-- l'exception La Poste (SIREN 356000000, somme des chiffres multiple de 5).
create or replace function public.is_valid_siret(value text)
returns boolean
language plpgsql
immutable
as $$
declare
  total int := 0;
  digit int;
  i int;
begin
  if value is null or value !~ '^\d{14}$' then
    return false;
  end if;
  for i in 0..13 loop
    digit := substr(value, 14 - i, 1)::int;
    if i % 2 = 1 then
      digit := digit * 2;
      if digit > 9 then
        digit := digit - 9;
      end if;
    end if;
    total := total + digit;
  end loop;
  if total % 10 = 0 then
    return true;
  end if;
  if left(value, 9) = '356000000' then
    select sum(d::int) into total from regexp_split_to_table(value, '') as d;
    return total % 5 = 0;
  end if;
  return false;
end;
$$;

alter table public.profiles drop constraint if exists profiles_entity_type_check;
alter table public.profiles add constraint profiles_entity_type_check
  check (entity_type is null or entity_type in ('company', 'association'));

alter table public.profiles drop constraint if exists profiles_siret_check;
alter table public.profiles add constraint profiles_siret_check
  check (siret is null or public.is_valid_siret(siret));

alter table public.profiles drop constraint if exists profiles_rna_check;
alter table public.profiles add constraint profiles_rna_check
  check (rna is null or rna ~ '^W\d{9}$');

alter table public.profiles drop constraint if exists profiles_verification_status_check;
alter table public.profiles add constraint profiles_verification_status_check
  check (verification_status in ('non_renseigne', 'a_verifier', 'verifie', 'refuse'));

update public.profiles
set entity_type = case role when 'pro' then 'company' when 'association' then 'association' end
where entity_type is null and role in ('pro', 'association');

-- security invoker (pas definer) : current_user doit refléter l'appelant réel pour distinguer un
-- client authentifié ('authenticated') du service_role / SQL editor.
create or replace function public.enforce_profile_identity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  privileged boolean := current_user not in ('authenticated', 'anon') or public.is_admin();
begin
  new.entity_type := case new.role
    when 'pro' then 'company'
    when 'association' then 'association'
    else null
  end;

  if new.entity_type is distinct from 'company' or new.siret is not null then
    new.immatriculation_en_cours := false;
  end if;

  if tg_op = 'UPDATE' and new.role is distinct from old.role and not privileged then
    raise exception 'Le type de compte ne peut pas être modifié.' using errcode = '42501';
  end if;

  if not privileged then
    if tg_op = 'INSERT'
      or new.siret is distinct from old.siret
      or new.rna is distinct from old.rna then
      new.verification_status := case
        when new.siret is null and new.rna is null then 'non_renseigne'
        else 'a_verifier'
      end;
      new.verified_at := null;
    else
      new.verification_status := old.verification_status;
      new.verified_at := old.verified_at;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_profile_identity on public.profiles;
create trigger trg_enforce_profile_identity
before insert or update on public.profiles
for each row execute function public.enforce_profile_identity();

drop policy if exists "Une association crée son propre profil" on public.profiles;
create policy "Une association crée son propre profil"
on public.profiles for insert
to authenticated
with check (id = auth.uid() and role = 'association');

drop policy if exists "Une association modifie son propre profil" on public.profiles;
create policy "Une association modifie son propre profil"
on public.profiles for update
to authenticated
using (id = auth.uid() and role = 'association')
with check (id = auth.uid() and role = 'association');

drop policy if exists "Un pro ou une association crée sa fiche" on public.commerces;
create policy "Un pro ou une association crée sa fiche"
on public.commerces for insert
to authenticated
with check (
  owner_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        p.role = 'pro'
        or (p.role = 'association' and (p.rna is not null or p.siret is not null))
      )
  )
);
