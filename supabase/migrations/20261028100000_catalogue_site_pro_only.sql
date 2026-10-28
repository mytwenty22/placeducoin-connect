-- Catalogue produits (ajout manuel et import CSV) réservé aux abonnés Site Pro (19 €/mois,
-- commerces.site_actif).
--
-- Avant cette migration, "Lecture publique produits" exposait le catalogue de toutes les fiches,
-- gratuites comprises, et n'importe quel propriétaire pouvait insérer des produits : un appel
-- direct à l'API (clé publique + son compte) contournait le verrou de l'Espace Pro.
--
-- Désormais :
-- - lecture publique uniquement pour une fiche Site Pro non suspendue ; le propriétaire voit
--   toujours ses propres produits (et un admin tous), y compris après résiliation, pour pouvoir
--   les retrouver en se réabonnant ou les supprimer ;
-- - ajout (manuel ou CSV) uniquement si la fiche est Site Pro ;
-- - suppression toujours permise au propriétaire.
-- site_actif ne s'active que via Stripe (trigger enforce_commerce_paid_fields) : le catalogue
-- réapparaît donc sur la vitrine dès la souscription et disparaît à la résiliation.

drop policy if exists "Lecture publique produits" on public.produits;
create policy "Lecture publique produits"
on public.produits for select
using (
  exists (
    select 1 from public.commerces c
    where c.id = commerce_id
      and (
        (c.site_actif and c.suspended_at is null)
        or c.owner_id = auth.uid()
        or public.is_admin()
      )
  )
);

drop policy if exists "Un pro ajoute des produits a sa fiche" on public.produits;
create policy "Un pro ajoute des produits a sa fiche"
on public.produits for insert
to authenticated
with check (
  exists (
    select 1 from public.commerces c
    where c.id = commerce_id and c.owner_id = auth.uid() and c.site_actif
  )
);
