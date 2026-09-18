-- Grille tarifaire fixe (test 7j / standard 1 mois / exclusif 1 mois) et réservation jusqu'à 6
-- mois à l'avance : la fenêtre de diffusion (starts_at -> expires_at) est désormais distincte de
-- la date d'achat (created_at), pour qu'une bannière achetée aujourd'hui pour décembre ne
-- s'affiche ni ne compte dans le quota avant décembre.
alter table public.banners add column if not exists tier text not null default 'standard'
  check (tier in ('test', 'standard', 'exclusif'));
alter table public.banners add column if not exists starts_at timestamptz not null default now();

-- Les réservations existantes (créées avant cette colonne) sont traitées comme actives dès leur
-- création -- starts_at garde son défaut `now()` au moment de la migration, ce qui est déjà
-- cohérent puisqu'elles s'affichaient déjà.

-- "Annuler" passera désormais par une simple désactivation (active=false) plutôt qu'une
-- suppression, pour que le quota et l'historique des réservations restent cohérents après coup ;
-- aucun changement de policy n'est nécessaire, la policy "Un pro met a jour sa propre reservation"
-- (update) couvre déjà ce cas.
