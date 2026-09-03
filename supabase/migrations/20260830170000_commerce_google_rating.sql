alter table public.commerces
  add column google_rating numeric(2, 1) check (google_rating >= 0 and google_rating <= 5),
  add column google_review_count integer not null default 0 check (google_review_count >= 0);

-- Valeurs d'exemple forcées sur toutes les fiches (y compris déjà existantes), pour
-- visualiser le rendu immédiatement sur la démo : note entre 4.5 et 4.9, avis entre 12 et 85.
update public.commerces
set
  google_rating = round((4.5 + random() * 0.4)::numeric, 1),
  google_review_count = floor(12 + random() * 74)::int;
