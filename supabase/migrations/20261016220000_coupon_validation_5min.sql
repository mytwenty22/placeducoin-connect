-- Coupon validé sur place : l'écran "Coupon validé à l'instant" reste affiché 5 minutes (au lieu
-- de 10), puis le coupon passe au statut "Utilisé". Seule la durée change ; le contrôle de
-- distance (100 m) et l'unicité par client et par promo sont inchangés. Les activations déjà
-- enregistrées gardent leur expires_at.

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

  -- Déjà activée par ce client : on renvoie l'activation existante (écran encore valable ou non)
  -- sans recompter de conversion.
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

  -- Deux clics simultanés : la seconde insertion est ignorée, on relit l'activation gagnante.
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
