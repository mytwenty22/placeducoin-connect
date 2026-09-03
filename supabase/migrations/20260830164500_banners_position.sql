-- Permet de cibler l'emplacement d'une bannière sponsorisée : en haut de la
-- Marketplace (sous la recherche) ou tout en bas, juste au-dessus du footer.
alter table public.banners
  add column position text not null default 'top' check (position in ('top', 'bottom'));
