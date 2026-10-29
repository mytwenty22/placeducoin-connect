-- Interrupteur « Afficher sur ma page publique » de la carte Horaires & tarifs (Espace Pro) : le
-- commerçant peut masquer toute la section Tarifs & prestations de sa fiche et de son Site Pro,
-- par exemple quand son catalogue fait doublon. Les prestations saisies restent enregistrées.
-- Vrai par défaut : aucune fiche existante ne change.

alter table public.commerces
  add column if not exists prestations_visibles boolean not null default true;
