-- Identifiants Stripe sortis de public.commerces (lecture publique) vers une table privée.
--
-- La policy "Lecture publique commerces" laissait n'importe quel visiteur lire
-- stripe_customer_id et stripe_subscription_id via l'API. Ils vivent désormais dans
-- commerce_billing : RLS activée sans aucune policy et aucun droit pour anon/authenticated, donc
-- accessible uniquement au service_role (stripe-webhook, create-checkout-session,
-- cancel-subscription).
--
-- Étape 1 sur 2 : création et copie. Les colonnes de commerces sont supprimées par
-- 20261017170500_drop_commerce_stripe_columns.sql, une fois les fonctions redéployées.

create table if not exists public.commerce_billing (
  commerce_id uuid primary key references public.commerces (id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text unique,
  updated_at timestamptz not null default now()
);

alter table public.commerce_billing enable row level security;
revoke all on public.commerce_billing from anon, authenticated;

insert into public.commerce_billing (commerce_id, stripe_customer_id, stripe_subscription_id)
select id, stripe_customer_id, stripe_subscription_id
from public.commerces
where stripe_customer_id is not null or stripe_subscription_id is not null
on conflict (commerce_id) do update set
  stripe_customer_id = coalesce(excluded.stripe_customer_id, public.commerce_billing.stripe_customer_id),
  stripe_subscription_id = coalesce(excluded.stripe_subscription_id, public.commerce_billing.stripe_subscription_id),
  updated_at = now();
