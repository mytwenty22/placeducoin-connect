-- Suite de 20261028100000_catalogue_site_pro_only.sql : la base de production portait sur
-- public.produits des policies absentes des migrations du dépôt, qui annulaient le verrou Site Pro
-- (les policies permissives se cumulent en OU) :
-- - "Public read produits" (select, using true) : catalogue de toutes les fiches lisible ;
-- - "Commerce insert own produits" (insert, with check true) : insertion par n'importe qui,
--   même anon, sur n'importe quelle fiche ;
-- - "Commerce update own produits" (update, using true) : modification de n'importe quel produit.
-- L'application ne modifie jamais un produit (ajout et suppression seulement) : aucune policy
-- update n'est recréée.
--
-- La policy de suppression du propriétaire manquait aussi en production : elle est recréée.

drop policy if exists "Public read produits" on public.produits;
drop policy if exists "Commerce insert own produits" on public.produits;
drop policy if exists "Commerce update own produits" on public.produits;

drop policy if exists "Un pro supprime ses propres produits" on public.produits;
create policy "Un pro supprime ses propres produits"
on public.produits for delete
to authenticated
using (
  exists (select 1 from public.commerces c where c.id = commerce_id and c.owner_id = auth.uid())
);
