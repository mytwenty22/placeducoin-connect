-- Écran d'administration des fiches (commerçants et associations) dans /admin.
--
-- Statut affiché pour chaque fiche :
--   Suspendu                 commerces.suspended_at renseigné (fiche masquée du site public) ;
--   Validé                   identifiant du titulaire vérifié (profiles.verification_status) ;
--   En attente de vérif.     tous les autres cas (à vérifier, refusé, non renseigné).
--
-- Toutes les actions passent par des RPC security definer réservées aux admins : il n'existe pas
-- de policy d'écriture admin sur commerces, et les triggers de verrouillage (options payantes,
-- identité) laissent passer ces fonctions (current_user = propriétaire de la fonction).

alter table public.commerces add column if not exists suspended_at timestamptz;
alter table public.commerces add column if not exists suspension_reason text
  check (suspension_reason is null or char_length(suspension_reason) <= 300);

-- Une fiche suspendue disparaît du site public (marketplace, /commerce, /site, compteurs) ; son
-- titulaire la voit toujours dans son Espace Pro, et les admins dans /admin.
drop policy if exists "Lecture publique commerces" on public.commerces;
create policy "Lecture publique commerces"
on public.commerces for select
using (suspended_at is null or owner_id = auth.uid() or public.is_admin());

-- Une fiche suspendue ne peut plus publier d'offre (les alertes e-mail/push partiraient sinon).
create or replace function public.block_promos_of_suspended_commerce()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') and not public.is_admin() and exists (
    select 1 from public.commerces where id = new.commerce_id and suspended_at is not null
  ) then
    raise exception 'Votre fiche est suspendue : la publication d''offres est désactivée.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_block_promos_of_suspended_commerce on public.promos;
create trigger trg_block_promos_of_suspended_commerce
before insert on public.promos
for each row execute function public.block_promos_of_suspended_commerce();

create or replace function public.admin_list_fiches()
returns table (
  commerce_id uuid,
  nom text,
  slug text,
  trade text,
  category text,
  ville_id uuid,
  ville_nom text,
  adresse text,
  telephone text,
  description text,
  site_actif boolean,
  boost_actif boolean,
  boost_expires_at timestamptz,
  suspended_at timestamptz,
  suspension_reason text,
  created_at timestamptz,
  owner_id uuid,
  email text,
  role text,
  verification_status text,
  siret text,
  rna text,
  legal_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs.' using errcode = '42501';
  end if;

  return query
  select
    c.id, c.nom, c.slug, c.trade, c.category::text, c.ville_id, v.nom, c.adresse, c.telephone,
    c.description, c.site_actif, c.boost_actif, c.boost_expires_at, c.suspended_at,
    c.suspension_reason, c.created_at, c.owner_id, u.email::text, p.role::text,
    p.verification_status, p.siret, p.rna, p.legal_name
  from public.commerces c
  left join public.villes v on v.id = c.ville_id
  left join public.profiles p on p.id = c.owner_id
  left join auth.users u on u.id = c.owner_id
  order by c.created_at desc;
end;
$$;

create or replace function public.admin_set_fiche_status(
  p_commerce_id uuid,
  p_action text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs.' using errcode = '42501';
  end if;

  select owner_id into v_owner from public.commerces where id = p_commerce_id;
  if not found then
    raise exception 'Fiche introuvable.' using errcode = 'P0002';
  end if;

  if p_action = 'validate' then
    -- Validation manuelle du titulaire (identifiant contrôlé à la main), et levée d'une
    -- éventuelle suspension.
    update public.profiles
    set verification_status = 'verifie', verified_at = now()
    where id = v_owner;
    update public.commerces set suspended_at = null, suspension_reason = null
    where id = p_commerce_id;
  elsif p_action = 'suspend' then
    update public.commerces
    set suspended_at = now(), suspension_reason = nullif(btrim(coalesce(p_reason, '')), '')
    where id = p_commerce_id;
  elsif p_action = 'reactivate' then
    update public.commerces set suspended_at = null, suspension_reason = null
    where id = p_commerce_id;
  else
    raise exception 'Action inconnue.' using errcode = '22023';
  end if;
end;
$$;

create or replace function public.admin_update_fiche(
  p_commerce_id uuid,
  p_nom text,
  p_trade text,
  p_adresse text,
  p_telephone text,
  p_description text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs.' using errcode = '42501';
  end if;
  if char_length(btrim(coalesce(p_nom, ''))) < 2 then
    raise exception 'Le nom de la fiche est obligatoire.' using errcode = '22023';
  end if;

  update public.commerces
  set
    nom = btrim(p_nom),
    trade = btrim(coalesce(p_trade, '')),
    adresse = nullif(btrim(coalesce(p_adresse, '')), ''),
    telephone = nullif(btrim(coalesce(p_telephone, '')), ''),
    description = nullif(btrim(coalesce(p_description, '')), '')
  where id = p_commerce_id;
  if not found then
    raise exception 'Fiche introuvable.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.admin_list_fiches() from public, anon;
revoke all on function public.admin_set_fiche_status(uuid, text, text) from public, anon;
revoke all on function public.admin_update_fiche(uuid, text, text, text, text, text) from public, anon;
grant execute on function public.admin_list_fiches() to authenticated;
grant execute on function public.admin_set_fiche_status(uuid, text, text) to authenticated;
grant execute on function public.admin_update_fiche(uuid, text, text, text, text, text) to authenticated;
