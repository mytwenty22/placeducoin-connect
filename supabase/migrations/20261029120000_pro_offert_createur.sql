-- Site Pro offert à vie, sans Stripe, pour les comptes dont l'e-mail (confirmé) figure dans
-- public.pro_offert_emails : au départ, le créateur de SpotLocal.
--
-- - La liste n'a aucune policy RLS ni aucun droit client : illisible et non modifiable depuis
--   l'application (ajout ou retrait d'un e-mail : SQL editor ou nouvelle migration).
-- - enforce_commerce_paid_fields force site_actif à true pour ces comptes, à la création de la
--   fiche comme à chaque modification : ni le webhook Stripe ni la fonction cancel-subscription ne
--   peuvent le couper. Les autres comptes gardent
--   exactement la règle précédente (activation via Stripe uniquement).
-- - mon_pro_offert() permet à l'Espace Pro d'afficher « Site Pro offert » au lieu des boutons
--   d'abonnement.

create table if not exists public.pro_offert_emails (
  email text primary key check (email = lower(email)),
  note text,
  created_at timestamptz not null default now()
);
alter table public.pro_offert_emails enable row level security;
revoke all on public.pro_offert_emails from anon, authenticated;

insert into public.pro_offert_emails (email, note)
values ('mytwentymihabodytec@gmail.com', 'Créateur de SpotLocal : Site Pro offert à vie')
on conflict (email) do nothing;

-- Un client connecté ne peut interroger que son propre compte ; les rôles serveur (webhook,
-- fonctions, migrations) peuvent interroger n'importe quel propriétaire.
create or replace function public.has_pro_offert(uid uuid)
returns boolean
language sql
security definer
set search_path = public, auth
stable
as $$
  select exists (
    select 1
    from auth.users u
    join public.pro_offert_emails p on p.email = lower(u.email)
    where u.id = uid
      and u.email_confirmed_at is not null
      and (uid = auth.uid() or coalesce(auth.role(), '') not in ('authenticated', 'anon'))
  );
$$;
revoke execute on function public.has_pro_offert(uuid) from public, anon;
grant execute on function public.has_pro_offert(uuid) to authenticated, service_role;

create or replace function public.mon_pro_offert()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select auth.uid() is not null and public.has_pro_offert(auth.uid());
$$;
revoke execute on function public.mon_pro_offert() from public, anon;
grant execute on function public.mon_pro_offert() to authenticated;

-- Reprend 20261017170500_drop_commerce_stripe_columns.sql, avec le cas du Site Pro offert.
create or replace function public.enforce_commerce_paid_fields()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_offert boolean := new.owner_id is not null and public.has_pro_offert(new.owner_id);
begin
  -- Site Pro offert : toujours actif, y compris face au webhook Stripe ou à une annulation.
  if v_offert then
    new.site_actif := true;
  end if;

  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.site_actif := v_offert;
    new.boost_actif := false;
    new.boost_expires_at := null;
    new.google_rating := null;
    new.google_review_count := 0;
    return new;
  end if;

  if new.site_actif and not old.site_actif and not v_offert then
    raise exception 'Le Site Pro s''active uniquement via le paiement Stripe.' using errcode = '42501';
  end if;

  if new.boost_actif
    and (not old.boost_actif or new.boost_expires_at is distinct from old.boost_expires_at) then
    raise exception 'L''option Vedette s''active uniquement via le paiement Stripe.' using errcode = '42501';
  end if;

  if new.google_rating is distinct from old.google_rating
    or new.google_review_count is distinct from old.google_review_count then
    raise exception 'Ces champs ne sont pas modifiables depuis l''espace Pro.' using errcode = '42501';
  end if;

  return new;
end;
$$;

-- Fiche déjà créée par un compte offert : Site Pro activé tout de suite.
update public.commerces c
set site_actif = true
from auth.users u
join public.pro_offert_emails p on p.email = lower(u.email)
where c.owner_id = u.id
  and u.email_confirmed_at is not null
  and not c.site_actif;
