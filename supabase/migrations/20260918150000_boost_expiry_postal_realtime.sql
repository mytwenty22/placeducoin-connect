-- Vedette (boost_actif) est une option 24h : on capture sa date d'expiration pour que le badge
-- "En Vedette" et l'encart "À la une" disparaissent d'eux-mêmes à l'heure dite, sans action
-- explicite ni délai de cache -- la marketplace compare juste boost_expires_at à now() à chaque
-- lecture plutôt que de dépendre d'un job qui repasserait boost_actif à false.
alter table public.commerces add column if not exists boost_expires_at timestamptz;

-- Les lignes déjà en boost_actif=true (activées avant l'ajout de cette colonne) repartent pour
-- 24h fraîches plutôt que d'expirer instantanément au déploiement.
update public.commerces
set boost_expires_at = now() + interval '24 hours'
where boost_actif = true and boost_expires_at is null;

-- Code postal, obligatoire côté formulaire Pro, pour fiabiliser le rattachement de chaque fiche
-- à la bonne commune en complément de ville_id.
alter table public.commerces add column if not exists code_postal text;

-- La marketplace doit refléter en direct (sans délai de cache) l'annulation d'une option
-- (Vedette, Site Pro, Bannière) ou la suppression d'une promo : on publie ces tables sur le
-- canal Realtime pour que le client invalide son cache React Query dès l'écriture en base,
-- au lieu d'attendre son prochain refetch naturel.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'commerces'
  ) then
    alter publication supabase_realtime add table public.commerces;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'promos'
  ) then
    alter publication supabase_realtime add table public.promos;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'banners'
  ) then
    alter publication supabase_realtime add table public.banners;
  end if;
end $$;
