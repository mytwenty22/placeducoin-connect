alter table public.commerces
  add column description text,
  add column horaires jsonb not null default '[]'::jsonb;
