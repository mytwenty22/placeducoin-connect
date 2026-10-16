-- Widget "Statistiques ROI" de l'Espace Pro.
--
-- 1. Nouvel événement offer_view : une carte commerce portant une offre active, vue à l'écran sur
--    la marketplace (journalisé une fois par visite et par commerce, voir OfferCard).
-- 2. public.commerce_roi_stats : totaux depuis l'origine, totaux et série quotidienne sur les
--    N derniers jours (fuseau Europe/Paris), en un seul appel. security invoker + contrôle explicite :
--    seul le propriétaire du commerce (ou un admin) obtient un résultat.

alter table public.commerce_stats_events
  drop constraint if exists commerce_stats_events_event_type_check;
alter table public.commerce_stats_events
  add constraint commerce_stats_events_event_type_check
  check (event_type in ('app_view', 'google_view', 'offer_view', 'coupon_open', 'coupon_validated'));

drop policy if exists "Un visiteur enregistre une vue ou l'ouverture d'un coupon" on public.commerce_stats_events;
create policy "Un visiteur enregistre une vue ou l'ouverture d'un coupon"
on public.commerce_stats_events for insert
to anon, authenticated
with check (event_type in ('app_view', 'google_view', 'offer_view', 'coupon_open'));

create index if not exists commerce_stats_events_commerce_created_idx
  on public.commerce_stats_events (commerce_id, created_at);

create or replace function public.commerce_roi_stats(p_commerce_id uuid, p_days integer default 30)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  v_days integer := least(greatest(coalesce(p_days, 30), 7), 90);
  v_today date := (now() at time zone 'Europe/Paris')::date;
  v_start date := v_today - (v_days - 1);
  v_result jsonb;
begin
  if not exists (
    select 1 from public.commerces
    where id = p_commerce_id and (owner_id = auth.uid() or public.is_admin())
  ) then
    raise exception 'Accès refusé.' using errcode = '42501';
  end if;

  with events as (
    select event_type, (created_at at time zone 'Europe/Paris')::date as day
    from public.commerce_stats_events
    where commerce_id = p_commerce_id
  ),
  activations as (
    select (created_at at time zone 'Europe/Paris')::date as day, montant_estime
    from public.promo_activations
    where commerce_id = p_commerce_id
  ),
  days as (
    select d::date as day from generate_series(v_start, v_today, interval '1 day') d
  ),
  daily as (
    select
      days.day,
      (select count(*) from events e where e.day = days.day and e.event_type = 'app_view') as fiche_views,
      (select count(*) from events e where e.day = days.day and e.event_type = 'offer_view') as offer_views,
      (select count(*) from events e where e.day = days.day and e.event_type = 'coupon_open') as coupons_generated,
      (select count(*) from events e where e.day = days.day and e.event_type = 'coupon_validated')
        + (select count(*) from activations a where a.day = days.day) as coupons_redeemed
    from days
  )
  select jsonb_build_object(
    'days', v_days,
    'totals', jsonb_build_object(
      'fiche_views', (select count(*) from events where event_type = 'app_view'),
      'google_views', (select count(*) from events where event_type = 'google_view'),
      'offer_views', (select count(*) from events where event_type = 'offer_view'),
      'coupons_generated', (select count(*) from events where event_type = 'coupon_open'),
      'coupons_redeemed', (select count(*) from events where event_type = 'coupon_validated')
        + (select count(*) from activations),
      'onsite_redeemed', (select count(*) from activations),
      'estimated_revenue', (select coalesce(sum(montant_estime), 0) from activations)
    ),
    'period', jsonb_build_object(
      'fiche_views', (select coalesce(sum(fiche_views), 0) from daily),
      'offer_views', (select coalesce(sum(offer_views), 0) from daily),
      'coupons_generated', (select coalesce(sum(coupons_generated), 0) from daily),
      'coupons_redeemed', (select coalesce(sum(coupons_redeemed), 0) from daily),
      'estimated_revenue', (select coalesce(sum(montant_estime), 0) from activations where day >= v_start)
    ),
    'daily', (
      select jsonb_agg(jsonb_build_object(
        'day', day,
        'fiche_views', fiche_views,
        'offer_views', offer_views,
        'coupons_generated', coupons_generated,
        'coupons_redeemed', coupons_redeemed
      ) order by day)
      from daily
    )
  ) into v_result;

  return v_result;
end;
$$;

revoke all on function public.commerce_roi_stats(uuid, integer) from public, anon;
grant execute on function public.commerce_roi_stats(uuid, integer) to authenticated;
