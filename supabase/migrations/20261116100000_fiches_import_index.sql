-- Import CSV de fiches (admin_create_unclaimed_fiches) : pour chaque ligne, la fonction cherche une
-- fiche déjà présente dans la commune (même nom, même adresse). Sans index, chaque recherche
-- parcourt toute la table commerces ; avec, l'import d'une commune complète reste rapide.
create index if not exists commerces_ville_nom_idx
  on public.commerces (ville_id, lower(btrim(nom)));
