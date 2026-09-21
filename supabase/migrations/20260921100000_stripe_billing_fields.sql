-- Champs nécessaires pour relier un commerce à ses objets Stripe : le customer id permet de
-- réutiliser le même client Stripe d'un paiement à l'autre, le subscription id permet à la
-- fonction d'annulation d'appeler l'API Stripe (et pas seulement de désactiver le flag en base)
-- quand l'abonnement Site Pro a réellement été payé via Stripe Checkout.
alter table public.commerces add column if not exists stripe_customer_id text;
alter table public.commerces add column if not exists stripe_subscription_id text;
