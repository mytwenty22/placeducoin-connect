-- Event log backing the Espace Pro "Statistiques" module: app views, Google (organic-search
-- referrer) views, coupon opens and coupon validations. Visitors can log a view or a coupon open
-- for any commerce (anonymous, like the rest of the public site), but only the owning pro can
-- log a coupon validation (they tap it in-store when honoring a coupon) or read the events back
-- to compute their own stats.

create table if not exists public.commerce_stats_events (
  id uuid primary key default gen_random_uuid(),
  commerce_id uuid not null references public.commerces (id) on delete cascade,
  event_type text not null check (event_type in ('app_view', 'google_view', 'coupon_open', 'coupon_validated')),
  created_at timestamptz not null default now()
);

create index if not exists commerce_stats_events_commerce_id_idx on public.commerce_stats_events (commerce_id);

alter table public.commerce_stats_events enable row level security;

drop policy if exists "Un visiteur enregistre une vue ou l'ouverture d'un coupon" on public.commerce_stats_events;
drop policy if exists "Permettre l'insertion anonyme d'événements stats" on public.commerce_stats_events;
create policy "Un visiteur enregistre une vue ou l'ouverture d'un coupon"
on public.commerce_stats_events for insert
to anon, authenticated
with check (event_type in ('app_view', 'google_view', 'coupon_open'));

drop policy if exists "Un pro valide un coupon de son commerce" on public.commerce_stats_events;
create policy "Un pro valide un coupon de son commerce"
on public.commerce_stats_events for insert
to authenticated
with check (
  event_type = 'coupon_validated'
  and exists (select 1 from public.commerces c where c.id = commerce_id and c.owner_id = auth.uid())
);

drop policy if exists "Un pro lit les statistiques de son commerce" on public.commerce_stats_events;
drop policy if exists "Lecture des stats réservée au propriétaire" on public.commerce_stats_events;
create policy "Un pro lit les statistiques de son commerce"
on public.commerce_stats_events for select
to authenticated
using (
  exists (select 1 from public.commerces c where c.id = commerce_id and c.owner_id = auth.uid())
  or public.is_admin()
);
