-- Lets a pro self-serve a banner reservation for their own city (mirrors the existing
-- "activer gratuitement (mode démo)" pattern for site_actif/boost_actif), but only inside the
-- géographic zone PlaceDuCoin covers. banner_zones holds the allowed département codes (33, 47)
-- so the zone can be adjusted with a row insert/delete instead of a code change; villes.
-- department_code is what a reservation is checked against. Ownership is checked via
-- banners.commerce_id -> commerces.owner_id (there's no banners.owner_id column).

alter table public.villes add column if not exists department_code text;
update public.villes set department_code = '33' where slug = 'canejan' and department_code is null;

create table if not exists public.banner_zones (
  id uuid primary key default gen_random_uuid(),
  department_code text not null,
  max_active_banners integer not null default 5,
  created_at timestamptz not null default now()
);

alter table public.banner_zones enable row level security;

drop policy if exists "Lecture publique banner_zones" on public.banner_zones;
create policy "Lecture publique banner_zones"
on public.banner_zones for select
using (true);

drop policy if exists "Admin gere les banner_zones" on public.banner_zones;
create policy "Admin gere les banner_zones"
on public.banner_zones for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

insert into public.banner_zones (department_code, max_active_banners)
select d, 5
from unnest(array['33', '47']) as d
where not exists (select 1 from public.banner_zones bz where bz.department_code = d);

alter table public.banners add column if not exists commerce_id uuid references public.commerces (id) on delete cascade;
alter table public.banners add column if not exists target_departments text[];
alter table public.banners add column if not exists is_national boolean not null default false;

-- Dropped by exact name (including "Insert banners for pros", a stray policy that had no zone
-- or ownership restriction at all — QA found it let a pro reserve a banner for a commerce they
-- didn't own, anywhere, regardless of département).
drop policy if exists "Insert banners for pros" on public.banners;
drop policy if exists "Un pro reserve une banniere dans sa zone" on public.banners;
create policy "Un pro reserve une banniere dans sa zone"
on public.banners for insert
to authenticated
with check (
  exists (
    select 1
    from public.commerces c
    join public.villes v on v.id = c.ville_id
    where c.id = commerce_id
      and c.owner_id = auth.uid()
      and v.slug = city_slug
      and exists (select 1 from public.banner_zones bz where bz.department_code = v.department_code)
  )
);

drop policy if exists "Un pro voit ses propres reservations" on public.banners;
create policy "Un pro voit ses propres reservations"
on public.banners for select
to authenticated
using (
  exists (select 1 from public.commerces c where c.id = commerce_id and c.owner_id = auth.uid())
);

drop policy if exists "Un pro annule sa propre reservation" on public.banners;
create policy "Un pro annule sa propre reservation"
on public.banners for delete
to authenticated
using (
  exists (select 1 from public.commerces c where c.id = commerce_id and c.owner_id = auth.uid())
);

drop policy if exists "Un pro met a jour sa propre reservation" on public.banners;
create policy "Un pro met a jour sa propre reservation"
on public.banners for update
to authenticated
using (
  exists (select 1 from public.commerces c where c.id = commerce_id and c.owner_id = auth.uid())
)
with check (
  exists (select 1 from public.commerces c where c.id = commerce_id and c.owner_id = auth.uid())
);
