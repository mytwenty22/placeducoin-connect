-- Replaces the free-text "contact" field (email-or-phone, auto-detected) with a real citizen
-- signup form: nom, email, telephone (optional), and ville_id so a Mairie can eventually target
-- notifications to its own commune (the previous design had no city scoping at all). Safe to
-- redefine the columns outright: alert_subscriptions has zero rows in production (nothing has
-- ever read/dispatched from it yet) and only PreferencesPanel.tsx writes to it.
alter table public.alert_subscriptions drop constraint if exists alert_subscriptions_contact_check;
alter table public.alert_subscriptions drop constraint if exists alert_subscriptions_contact_type_check;
alter table public.alert_subscriptions drop column if exists contact;
alter table public.alert_subscriptions drop column if exists contact_type;

alter table public.alert_subscriptions add column nom text not null default '';
alter table public.alert_subscriptions add column email text not null default '';
alter table public.alert_subscriptions add column telephone text;
alter table public.alert_subscriptions add column ville_id uuid not null references public.villes (id);

alter table public.alert_subscriptions alter column nom drop default;
alter table public.alert_subscriptions alter column email drop default;

alter table public.alert_subscriptions add constraint alert_subscriptions_nom_check
  check (char_length(trim(nom)) > 0);
alter table public.alert_subscriptions add constraint alert_subscriptions_email_check
  check (char_length(trim(email)) > 0);

create index if not exists alert_subscriptions_ville_id_idx on public.alert_subscriptions (ville_id);
