-- Tarifs & prestations de base d'une fiche (ex. « Coupe homme » / « 25 € »), saisis depuis
-- l'Espace Pro par toutes les formules, gratuite comprise, et affichés sur la vitrine publique.
-- Le prix est un texte libre (« à partir de 25 € », « sur devis »…).
-- Modifiable par le propriétaire via la policy existante "Un pro modifie sa fiche commerce" ;
-- lisible publiquement comme le reste de la fiche.

alter table public.commerces
  add column if not exists prestations jsonb not null default '[]'::jsonb;

alter table public.commerces drop constraint if exists commerces_prestations_is_array;
alter table public.commerces
  add constraint commerces_prestations_is_array check (jsonb_typeof(prestations) = 'array');
