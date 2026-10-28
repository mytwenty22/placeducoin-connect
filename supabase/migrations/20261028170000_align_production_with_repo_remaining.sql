-- Suite de 20261028160000_align_production_with_repo.sql : écarts restants entre la production et
-- le dépôt, sans effet fonctionnel aujourd'hui. Données vérifiées en production avant écriture :
-- aucune valeur nulle dans les colonnes passées en NOT NULL, aucun doublon dans favoris, aucune
-- référence à favoris.id (ni clé étrangère, ni code).
--
-- Deux écarts sont alignés dans le sens de la production, plus sûr : la valeur par défaut '{}' de
-- banners.target_departments et la colonne produits.updated_at (sans effet sur la production).

-- 1. Colonnes obligatoires dans le dépôt, facultatives en production.
alter table public.alert_subscriptions alter column categories set not null;
alter table public.alert_subscriptions alter column created_at set not null;
alter table public.banner_zones alter column max_active_banners set not null;
alter table public.banner_zones alter column created_at set not null;
alter table public.banners alter column position set not null;
alter table public.banners alter column is_national set not null;
alter table public.banners alter column tier set not null;
alter table public.banners alter column starts_at set not null;
alter table public.commerce_stats_events alter column created_at set not null;
alter table public.favoris alter column created_at set not null;
alter table public.notifications alter column user_id set not null;
alter table public.notifications alter column read set not null;
alter table public.notifications alter column created_at set not null;
alter table public.produits alter column created_at set not null;

-- 2. Écarts repris de la production.
alter table public.banners alter column target_departments set default '{}'::text[];
alter table public.produits add column if not exists updated_at timestamptz default now();

-- 3. Favoris : clé primaire (user_id, commerce_id) comme dans le dépôt, au lieu d'un id technique
-- doublé d'une contrainte d'unicité sur le même couple.
alter table public.favoris drop constraint if exists favoris_pkey;
alter table public.favoris drop constraint if exists favoris_user_id_commerce_id_key;
alter table public.favoris drop column if exists id;
alter table public.favoris add constraint favoris_pkey primary key (user_id, commerce_id);

-- 4. Policies : noms et définitions du dépôt.
drop policy if exists "Permettre l'insertion publique des abonnements" on public.alert_subscriptions;
drop policy if exists "Un visiteur enregistre son contact d'alerte" on public.alert_subscriptions;
create policy "Un visiteur enregistre son contact d'alerte"
on public.alert_subscriptions for insert
to anon, authenticated
with check (true);

drop policy if exists "Seuls les admins peuvent lire les abonnements" on public.alert_subscriptions;
drop policy if exists "Admin lit les contacts d'alerte" on public.alert_subscriptions;
create policy "Admin lit les contacts d'alerte"
on public.alert_subscriptions for select
to authenticated
using (public.is_admin());

drop policy if exists "Lecture publique des zones de bannières" on public.banner_zones;
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

drop policy if exists "Lecture publique banners mefs" on public.banners;
drop policy if exists "Lecture publique banners actifs" on public.banners;
create policy "Lecture publique banners actifs"
on public.banners for select
using (active = true);

drop policy if exists "Un pro voit ses propres reservations" on public.banners;
create policy "Un pro voit ses propres reservations"
on public.banners for select
to authenticated
using (exists (select 1 from public.commerces c where c.id = commerce_id and c.owner_id = auth.uid()));

drop policy if exists "Lecture des stats réservée au propriétaire" on public.commerce_stats_events;
drop policy if exists "Un pro lit les statistiques de son commerce" on public.commerce_stats_events;
create policy "Un pro lit les statistiques de son commerce"
on public.commerce_stats_events for select
to authenticated
using (
  exists (select 1 from public.commerces c where c.id = commerce_id and c.owner_id = auth.uid())
  or public.is_admin()
);

drop policy if exists "Un pro valide un coupon de son commerce" on public.commerce_stats_events;
create policy "Un pro valide un coupon de son commerce"
on public.commerce_stats_events for insert
to authenticated
with check (
  event_type = 'coupon_validated'
  and exists (select 1 from public.commerces c where c.id = commerce_id and c.owner_id = auth.uid())
);
