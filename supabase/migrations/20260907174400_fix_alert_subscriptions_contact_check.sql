-- QA check found that the deployed alert_subscriptions table accepts a whitespace-only contact
-- (e.g. "   ") despite 20260907170809_alert_subscriptions.sql defining
-- `check (char_length(trim(contact)) > 0)` — the constraint is missing from the live table as
-- actually applied. Re-added idempotently; any pre-existing blank-contact rows are cleared first
-- so the validation pass (which checks all existing rows by default) doesn't fail.

delete from public.alert_subscriptions where char_length(trim(contact)) = 0;

alter table public.alert_subscriptions
  drop constraint if exists alert_subscriptions_contact_check;

alter table public.alert_subscriptions
  add constraint alert_subscriptions_contact_check check (char_length(trim(contact)) > 0);
