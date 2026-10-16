-- Notifications push Web : "Recevoir les bons plans du quartier".
--
-- Un abonnement = un navigateur (son endpoint push est unique). Il est rattaché à une commune et
-- à des catégories, comme alert_subscriptions : send-promo-alerts et send-mairie-alerts envoient
-- la notification aux abonnés de la commune du commerce / de la mairie.
--
-- Pas de policy : la table n'est lisible et modifiable que par le service_role (les fonctions
-- d'envoi). Le navigateur s'abonne et se désabonne via les deux RPC ci-dessous ; l'endpoint, une
-- URL secrète propre à ce navigateur, sert de preuve de possession, et il est accepté sans compte.

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique check (endpoint ~ '^https://' and char_length(endpoint) <= 1000),
  p256dh text not null check (char_length(p256dh) between 20 and 200),
  auth text not null check (char_length(auth) between 10 and 100),
  ville_id uuid not null references public.villes (id) on delete cascade,
  categories text[] not null default '{}',
  user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_subscriptions_ville_idx on public.push_subscriptions (ville_id);

alter table public.push_subscriptions enable row level security;

create or replace function public.save_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_ville_id uuid,
  p_categories text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.villes where id = p_ville_id) then
    raise exception 'Commune inconnue.' using errcode = '22023';
  end if;

  insert into public.push_subscriptions (endpoint, p256dh, auth, ville_id, categories, user_id)
  values (p_endpoint, p_p256dh, p_auth, p_ville_id, coalesce(p_categories, '{}'), auth.uid())
  on conflict (endpoint) do update set
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    ville_id = excluded.ville_id,
    categories = excluded.categories,
    user_id = coalesce(excluded.user_id, public.push_subscriptions.user_id),
    updated_at = now();
end;
$$;

create or replace function public.delete_push_subscription(p_endpoint text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.push_subscriptions where endpoint = p_endpoint;
$$;

revoke all on function public.save_push_subscription(text, text, text, uuid, text[]) from public;
revoke all on function public.delete_push_subscription(text) from public;
grant execute on function public.save_push_subscription(text, text, text, uuid, text[]) to anon, authenticated;
grant execute on function public.delete_push_subscription(text) to anon, authenticated;

-- E-mail de bienvenue envoyé par verify-identity au premier identifiant vérifié : la date
-- garantit un envoi unique, même si le statut repasse par "à vérifier" plus tard.
alter table public.profiles add column if not exists welcome_email_sent_at timestamptz;
