-- Validation d'un coupon par code PIN commerçant, en secours de la validation GPS (géolocalisation
-- refusée, indisponible, trop imprécise, ou client annoncé trop loin du commerce).
--
-- Le code (4 chiffres) n'est JAMAIS stocké dans la table publique commerces : il vit dans
-- commerce_pins, sans aucun droit client. Seules les fonctions ci-dessous (security definer) le
-- lisent : le propriétaire peut le consulter/modifier depuis l'Espace Pro, et le client ne fait
-- que le soumettre. Tant que le commerçant n'a pas choisi de code, c'est "1234".
--
-- Anti-devinette : 5 codes faux par client et par commerce sur 15 minutes bloquent la saisie.

create table if not exists public.commerce_pins (
  commerce_id uuid primary key references public.commerces (id) on delete cascade,
  pin text not null check (pin ~ '^[0-9]{4}$'),
  updated_at timestamptz not null default now()
);

alter table public.commerce_pins enable row level security;
revoke all on public.commerce_pins from anon, authenticated;

create table if not exists public.pin_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  commerce_id uuid not null references public.commerces (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists pin_attempts_user_commerce_idx
  on public.pin_attempts (user_id, commerce_id, created_at desc);

alter table public.pin_attempts enable row level security;
revoke all on public.pin_attempts from anon, authenticated;

-- Une activation par PIN n'a pas de distance mesurée.
alter table public.promo_activations alter column distance_m drop not null;
alter table public.promo_activations
  add column if not exists method text not null default 'gps' check (method in ('gps', 'pin'));

-- Code du commerce, pour son propriétaire (ou un admin). "1234" tant qu'aucun code n'est choisi.
create or replace function public.get_commerce_pin(p_commerce_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_pin text;
begin
  if not exists (
    select 1 from public.commerces
    where id = p_commerce_id and (owner_id = auth.uid() or public.is_admin())
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  select pin into v_pin from public.commerce_pins where commerce_id = p_commerce_id;
  return coalesce(v_pin, '1234');
end;
$$;

create or replace function public.set_commerce_pin(p_commerce_id uuid, p_pin text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.commerces
    where id = p_commerce_id and (owner_id = auth.uid() or public.is_admin())
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then
    raise exception 'invalid_pin' using errcode = '22023';
  end if;
  insert into public.commerce_pins (commerce_id, pin, updated_at)
  values (p_commerce_id, p_pin, now())
  on conflict (commerce_id) do update set pin = excluded.pin, updated_at = now();
end;
$$;

create or replace function public.activate_promo_with_pin(p_promo_id uuid, p_pin text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  c_validity_minutes constant integer := 5;
  c_max_failures constant integer := 5;
  c_lock_window constant interval := interval '15 minutes';
  v_uid uuid := auth.uid();
  v_promo public.promos%rowtype;
  v_commerce public.commerces%rowtype;
  v_existing public.promo_activations%rowtype;
  v_expected text;
  v_failures integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_promo from public.promos where id = p_promo_id;
  if not found or v_promo.kind not in ('promo', 'arrivage') or v_promo.valide_jusqu_a <= now() then
    return jsonb_build_object('status', 'promo_unavailable');
  end if;

  select * into v_commerce from public.commerces where id = v_promo.commerce_id;
  if v_commerce.owner_id = v_uid then
    return jsonb_build_object('status', 'own_commerce');
  end if;

  -- Déjà activée par ce client (GPS ou PIN) : même réponse que activate_promo.
  select * into v_existing from public.promo_activations
  where promo_id = p_promo_id and user_id = v_uid;
  if found then
    return jsonb_build_object(
      'status', case when v_existing.expires_at > now() then 'already_active' else 'already_used' end,
      'expires_at', v_existing.expires_at
    );
  end if;

  select count(*) into v_failures from public.pin_attempts
  where user_id = v_uid and commerce_id = v_commerce.id and created_at > now() - c_lock_window;
  if v_failures >= c_max_failures then
    return jsonb_build_object('status', 'locked');
  end if;

  select pin into v_expected from public.commerce_pins where commerce_id = v_commerce.id;
  if p_pin is null or p_pin is distinct from coalesce(v_expected, '1234') then
    insert into public.pin_attempts (user_id, commerce_id) values (v_uid, v_commerce.id);
    return jsonb_build_object(
      'status', 'wrong_pin',
      'attempts_left', greatest(0, c_max_failures - v_failures - 1)
    );
  end if;

  insert into public.promo_activations
    (promo_id, promo_titre, commerce_id, user_id, montant_estime, distance_m, method, expires_at)
  values
    (p_promo_id, v_promo.titre, v_commerce.id, v_uid, coalesce(v_promo.prix_maintenant, 0),
     null, 'pin', now() + make_interval(mins => c_validity_minutes))
  on conflict (promo_id, user_id) do nothing;

  select * into v_existing from public.promo_activations
  where promo_id = p_promo_id and user_id = v_uid;

  return jsonb_build_object('status', 'activated', 'expires_at', v_existing.expires_at);
end;
$$;

revoke all on function public.get_commerce_pin(uuid) from public, anon;
revoke all on function public.set_commerce_pin(uuid, text) from public, anon;
revoke all on function public.activate_promo_with_pin(uuid, text) from public, anon;
grant execute on function public.get_commerce_pin(uuid) to authenticated;
grant execute on function public.set_commerce_pin(uuid, text) to authenticated;
grant execute on function public.activate_promo_with_pin(uuid, text) to authenticated;
