-- Bannières publicitaires sponsorisées par commune, affichées sur la Marketplace
-- juste sous la barre de recherche.
create table public.banners (
  id uuid primary key default gen_random_uuid(),
  city_slug text not null references public.villes (slug) on delete cascade,
  image_url text not null,
  target_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.banners enable row level security;

create policy "Lecture publique banners actifs"
on public.banners for select
using (active = true);

-- Gestion réservée aux admins (pas d'interface Pro/Mairie pour ces bannières).
create policy "Admin gere les banners"
on public.banners for all
to authenticated
using (public.is_admin())
with check (public.is_admin());
