alter table public.commerces
  add column theme_visuel text not null default 'epure'
  check (theme_visuel in ('epure', 'chaleureux', 'sombre', 'dynamique'));
