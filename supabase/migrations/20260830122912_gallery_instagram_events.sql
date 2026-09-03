alter table public.commerces
  add column instagram text,
  add column galerie_urls text[] not null default '{}';

alter table public.promos
  add column description text;

-- Élargit le type de publication pour couvrir les événements (titre + date/heure + description),
-- en réutilisant valide_jusqu_a comme date/heure de l'événement.
alter table public.promos drop constraint if exists promos_kind_check;
alter table public.promos add constraint promos_kind_check check (kind in ('promo', 'arrivage', 'evenement'));
