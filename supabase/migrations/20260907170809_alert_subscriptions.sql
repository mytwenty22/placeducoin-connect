-- Lets a visitor (no login required, same as the rest of the preferences panel) leave a phone
-- number or email so they can be alerted about new commerce offers and mairie announcements for
-- the categories they picked. Each save is a fresh row (no update/select exposed to the public)
-- so a visitor can never read or overwrite another visitor's contact info — an admin-only read
-- policy is provided for whichever tool later sends the actual alerts.

create table public.alert_subscriptions (
  id uuid primary key default gen_random_uuid(),
  contact text not null check (char_length(trim(contact)) > 0),
  contact_type text not null check (contact_type in ('email', 'phone')),
  categories text[] not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.alert_subscriptions enable row level security;

create policy "Un visiteur enregistre son contact d'alerte"
on public.alert_subscriptions for insert
to anon, authenticated
with check (true);

create policy "Admin lit les contacts d'alerte"
on public.alert_subscriptions for select
to authenticated
using (public.is_admin());
