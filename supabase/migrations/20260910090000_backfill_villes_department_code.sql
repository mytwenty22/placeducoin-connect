-- 20260909205925_banner_zone_reservation.sql only backfilled villes.department_code for
-- "canejan"; every other commune (the demo cities in src/lib/placeducoin-data.ts's CITIES list,
-- and any real mairie created via the admin "Créer un compte Mairie" form) was left null. The
-- client-side BannerReservationCard treats a null department_code the same as "hors zone", so
-- pros in a commune PlaceDuCoin already covers had no way to see or use the reservation form
-- either -- the geo-gate was blocking everyone, not just out-of-zone businesses.
--
-- This maps the known demo cities to their real French département code (matched by slug via
-- src/lib/slugify.ts's slugify()). Communes not in this list keep department_code = null and
-- stay correctly treated as unmapped/out-of-zone until an admin sets their code by hand.
update public.villes as v
set department_code = m.department_code
from (
  values
    ('annecy', '74'),
    ('bayeux', '14'),
    ('colmar', '68'),
    ('dinan', '22'),
    ('etretat', '76'),
    ('figeac', '46'),
    ('gordes', '84'),
    ('honfleur', '14'),
    ('uzes', '30'),
    ('sarlat-la-caneda', '24'),
    ('saint-emilion', '33'),
    ('vannes', '56'),
    ('canejan', '33')
) as m(slug, department_code)
where v.slug = m.slug
  and v.department_code is null;
