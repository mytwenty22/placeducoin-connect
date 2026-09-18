-- Réserver une bannière n'avait aucune déduplication côté application : chaque clic sur
-- "Réserver" insérait une nouvelle ligne active=true sans jamais désactiver la précédente pour
-- le même commerce+position. Résultat en base : plusieurs bannières actives simultanées pour un
-- même commerce sur la même position, dont seule la plus récente s'affichait jamais sur la
-- marketplace (tri par created_at desc, limit 1) -- les autres restaient actives pour toujours,
-- gonflant artificiellement le compteur de capacité de la zone sans jamais s'afficher. On ne
-- garde que la plus récente comme active (désactivation, pas suppression, pour rester réversible).
with ranked as (
  select id, row_number() over (
    partition by commerce_id, position
    order by created_at desc
  ) as rn
  from public.banners
  where active = true and commerce_id is not null
)
update public.banners b
set active = false
from ranked
where b.id = ranked.id and ranked.rn > 1;

-- Une réservation de bannière a désormais une durée (1 semaine, 1 mois, ...) au lieu d'être
-- active indéfiniment. NULL = pas de date de fin (réservations historiques, jamais expirées).
alter table public.banners add column if not exists expires_at timestamptz;
