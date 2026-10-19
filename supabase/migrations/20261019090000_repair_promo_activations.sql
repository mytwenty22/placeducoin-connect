-- Rattrapage : en production, public.promo_activations est restée dans sa première forme (créée
-- hors du dépôt), sans expires_at ni distance_m, sans unicité (promo_id, user_id), avec une
-- policy d'insertion ouverte (un client pouvait créer ses propres activations sans contrôle de
-- distance) et une lecture `true` pour tout utilisateur connecté (toutes les activations de tous
-- les commerces visibles). La migration 20260921120000 devait la remplacer mais n'y a jamais été
-- appliquée. Conséquence : activate_promo échouait à l'exécution (colonnes absentes).
--
-- On remplace la table (uniquement si elle est dans l'ancienne forme ET vide), puis on réapplique
-- activate_promo (version 5 minutes, 20261016220000) et commerce_conversion_stats. Idempotent :
-- sans effet sur une base déjà à jour.

do $$
begin
  if to_regclass('public.promo_activations') is not null
     and not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'promo_activations' and column_name = 'expires_at'
     ) then
    if exists (select 1 from public.promo_activations) then
      raise exception 'public.promo_activations (ancienne forme) contient des lignes : à migrer manuellement.';
    end if;
    drop table public.promo_activations;
  end if;
end
$$;

create table if not exists public.promo_activations (
  id uuid primary key default gen_random_uuid(),
  promo_id uuid references public.promos (id) on delete set null,
  promo_titre text not null,
  commerce_id uuid not null references public.commerces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  montant_estime numeric not null default 0 check (montant_estime >= 0),
  distance_m integer not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  -- Une seule activation par client et par promo : évite de gonfler artificiellement le compteur.
  unique (promo_id, user_id)
);

create index if not exists promo_activations_commerce_id_idx
  on public.promo_activations (commerce_id, created_at desc);
create index if not exists promo_activations_user_id_idx on public.promo_activations (user_id);

alter table public.promo_activations enable row level security;

-- Aucune policy d'écriture : les lignes ne sont créées que par activate_promo() (security
-- definer), qui contrôle la distance. Les anciennes policies ouvertes disparaissent avec la table.
drop policy if exists "Lecture de ses activations, de celles de son commerce, ou admin" on public.promo_activations;
create policy "Lecture de ses activations, de celles de son commerce, ou admin"
on public.promo_activations for select
to authenticated
using (
  user_id = auth.uid()
  or exists (select 1 from public.commerces c where c.id = commerce_id and c.owner_id = auth.uid())
  or public.is_admin()
);

create or replace function public.activate_promo(
  p_promo_id uuid,
  p_lat double precision,
  p_lng double precision
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_radius_m constant integer := 100;
  c_validity_minutes constant integer := 5;
  v_uid uuid := auth.uid();
  v_promo public.promos%rowtype;
  v_commerce public.commerces%rowtype;
  v_existing public.promo_activations%rowtype;
  v_distance double precision;
  v_expires timestamptz;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_lat is null or p_lng is null or p_lat not between -90 and 90 or p_lng not between -180 and 180 then
    raise exception 'invalid_position';
  end if;

  select * into v_promo from public.promos where id = p_promo_id;
  if not found or v_promo.kind not in ('promo', 'arrivage') or v_promo.valide_jusqu_a <= now() then
    return jsonb_build_object('status', 'promo_unavailable');
  end if;

  select * into v_commerce from public.commerces where id = v_promo.commerce_id;
  if v_commerce.owner_id = v_uid then
    return jsonb_build_object('status', 'own_commerce');
  end if;
  if v_commerce.latitude is null or v_commerce.longitude is null then
    return jsonb_build_object('status', 'no_location');
  end if;

  select * into v_existing from public.promo_activations
  where promo_id = p_promo_id and user_id = v_uid;
  if found then
    return jsonb_build_object(
      'status', case when v_existing.expires_at > now() then 'already_active' else 'already_used' end,
      'expires_at', v_existing.expires_at
    );
  end if;

  -- Distance de grand cercle (haversine), en mètres.
  v_distance := 6371000 * 2 * asin(least(1, sqrt(
    power(sin(radians(p_lat - v_commerce.latitude) / 2), 2)
    + cos(radians(v_commerce.latitude)) * cos(radians(p_lat))
      * power(sin(radians(p_lng - v_commerce.longitude) / 2), 2)
  )));

  if v_distance > c_radius_m then
    return jsonb_build_object('status', 'too_far', 'distance_m', round(v_distance)::integer);
  end if;

  v_expires := now() + make_interval(mins => c_validity_minutes);
  insert into public.promo_activations
    (promo_id, promo_titre, commerce_id, user_id, montant_estime, distance_m, expires_at)
  values
    (p_promo_id, v_promo.titre, v_commerce.id, v_uid, coalesce(v_promo.prix_maintenant, 0),
     round(v_distance)::integer, v_expires)
  on conflict (promo_id, user_id) do nothing;

  select * into v_existing from public.promo_activations
  where promo_id = p_promo_id and user_id = v_uid;

  return jsonb_build_object(
    'status', 'activated',
    'expires_at', v_existing.expires_at,
    'distance_m', v_existing.distance_m
  );
end;
$$;

revoke all on function public.activate_promo(uuid, double precision, double precision) from public;
revoke all on function public.activate_promo(uuid, double precision, double precision) from anon;
grant execute on function public.activate_promo(uuid, double precision, double precision) to authenticated;

-- Même définition qu'en 20260921120000 : réappliquée par sécurité après le remplacement de la table.
create or replace function public.commerce_conversion_stats(p_commerce_id uuid)
returns table (
  promo_id uuid,
  promo_titre text,
  activations bigint,
  activations_30j bigint,
  montant_estime numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    a.promo_id,
    a.promo_titre,
    count(*) as activations,
    count(*) filter (where a.created_at > now() - interval '30 days') as activations_30j,
    coalesce(sum(a.montant_estime), 0) as montant_estime
  from public.promo_activations a
  where a.commerce_id = p_commerce_id
  group by a.promo_id, a.promo_titre
  order by count(*) desc, max(a.created_at) desc;
$$;

revoke all on function public.commerce_conversion_stats(uuid) from public;
revoke all on function public.commerce_conversion_stats(uuid) from anon;
grant execute on function public.commerce_conversion_stats(uuid) to authenticated;
