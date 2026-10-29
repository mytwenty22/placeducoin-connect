-- Modification d'un produit du catalogue depuis l'Espace Pro (nom, prix, description, photo).
--
-- 20261028110000_produits_drop_drift_policies.sql n'avait recréé aucune policy update, l'app ne
-- modifiant alors jamais un produit. Même règle que l'ajout : propriétaire de la fiche et Site Pro
-- actif (catalogue réservé à l'offre 19 €/mois). Le with check empêche aussi de déplacer un produit
-- vers la fiche d'un autre commerçant.

drop policy if exists "Un pro modifie ses propres produits" on public.produits;
create policy "Un pro modifie ses propres produits"
on public.produits for update
to authenticated
using (
  exists (
    select 1 from public.commerces c
    where c.id = commerce_id and c.owner_id = auth.uid() and c.site_actif
  )
)
with check (
  exists (
    select 1 from public.commerces c
    where c.id = commerce_id and c.owner_id = auth.uid() and c.site_actif
  )
);
