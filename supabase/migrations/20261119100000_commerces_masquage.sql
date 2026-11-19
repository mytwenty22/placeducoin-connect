-- Masquage éditorial des fiches (recentrage Métiers de Bouche pour le lancement).
--
-- Distinct de la suspension (sanction d'un titulaire, visible dans son Espace Pro) : une fiche
-- masquée est simplement retirée du site public, sans rien supprimer, pour pouvoir la réafficher
-- si d'autres catégories rouvrent. Réafficher = remettre masquee_at et masquage_motif à null.
--   hors_perimetre        métier hors des catégories ouvertes au lancement ;
--   fermee_ou_remplacee   commerce fermé au registre ou local repris (contrôle du 19/11/2026).

alter table public.commerces add column if not exists masquee_at timestamptz;
alter table public.commerces add column if not exists masquage_motif text;

alter table public.commerces drop constraint if exists commerces_masquage_motif_check;
alter table public.commerces add constraint commerces_masquage_motif_check
  check (
    (masquee_at is null and masquage_motif is null)
    or (masquee_at is not null and masquage_motif in ('hors_perimetre', 'fermee_ou_remplacee'))
  );

create index if not exists commerces_masquee_at_idx on public.commerces (masquee_at)
  where masquee_at is not null;

-- Même règle de lecture que la suspension : invisible du public, visible du titulaire et des admins.
drop policy if exists "Lecture publique commerces" on public.commerces;
create policy "Lecture publique commerces"
on public.commerces for select
using (
  (suspended_at is null and masquee_at is null)
  or owner_id = auth.uid()
  or public.is_admin()
);

drop policy if exists "Lecture publique produits" on public.produits;
create policy "Lecture publique produits"
on public.produits for select
using (
  exists (
    select 1 from public.commerces c
    where c.id = commerce_id
      and (
        (c.site_actif and c.suspended_at is null and c.masquee_at is null)
        or c.owner_id = auth.uid()
        or public.is_admin()
      )
  )
);
