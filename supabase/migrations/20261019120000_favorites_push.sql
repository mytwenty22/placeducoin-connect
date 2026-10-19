-- Notifications push "Promos Flash de mes favoris" : un navigateur peut désormais être abonné
-- (a) aux bons plans d'une commune (existant : ville_id + categories) et/ou (b) aux Promos Flash
-- des commerces que son utilisateur connecté a mis en favori (notify_favorites).
--
-- Un abonnement "favoris seulement" n'a pas de commune : ville_id devient facultatif
-- (sendPushToVille filtre sur ville_id = …, ces lignes n'y sont donc jamais incluses).
-- L'abonnement favoris est rattaché à auth.uid() au moment de l'activation : c'est ce compte dont
-- les favoris déclenchent les envois (send-promo-alerts).

alter table public.push_subscriptions alter column ville_id drop not null;
alter table public.push_subscriptions
  add column if not exists notify_favorites boolean not null default false;

create index if not exists push_subscriptions_favorites_user_idx
  on public.push_subscriptions (user_id) where notify_favorites;

-- État de l'abonnement de CE navigateur (l'endpoint, URL secrète propre au navigateur, sert de
-- preuve de possession, comme pour save/delete_push_subscription).
create or replace function public.get_push_subscription_state(p_endpoint text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select jsonb_build_object('ville_id', ville_id, 'notify_favorites', notify_favorites)
     from public.push_subscriptions where endpoint = p_endpoint),
    jsonb_build_object('ville_id', null, 'notify_favorites', false)
  );
$$;

-- Active / coupe les Promos Flash des favoris pour ce navigateur. Renvoie true si l'abonnement
-- sert encore à quelque chose (alertes de commune), false s'il a été supprimé : le navigateur
-- peut alors se désabonner du service push.
create or replace function public.set_favorites_push(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_enabled boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if p_enabled then
    if v_uid is null then
      raise exception 'Connectez-vous pour recevoir les offres de vos favoris.' using errcode = '42501';
    end if;
    insert into public.push_subscriptions (endpoint, p256dh, auth, ville_id, categories, user_id, notify_favorites)
    values (p_endpoint, p_p256dh, p_auth, null, '{}', v_uid, true)
    on conflict (endpoint) do update set
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      user_id = v_uid,
      notify_favorites = true,
      updated_at = now();
    return true;
  end if;

  update public.push_subscriptions
  set notify_favorites = false, updated_at = now()
  where endpoint = p_endpoint;
  delete from public.push_subscriptions
  where endpoint = p_endpoint and ville_id is null;
  return exists (select 1 from public.push_subscriptions where endpoint = p_endpoint);
end;
$$;

-- Coupe les alertes de commune de ce navigateur sans toucher aux Promos Flash des favoris.
-- Même valeur de retour que set_favorites_push.
create or replace function public.disable_ville_push(p_endpoint text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.push_subscriptions
  set ville_id = null, categories = '{}', updated_at = now()
  where endpoint = p_endpoint;
  delete from public.push_subscriptions
  where endpoint = p_endpoint and not notify_favorites;
  return exists (select 1 from public.push_subscriptions where endpoint = p_endpoint);
end;
$$;

revoke all on function public.get_push_subscription_state(text) from public;
revoke all on function public.set_favorites_push(text, text, text, boolean) from public;
revoke all on function public.disable_ville_push(text) from public;
grant execute on function public.get_push_subscription_state(text) to anon, authenticated;
grant execute on function public.set_favorites_push(text, text, text, boolean) to anon, authenticated;
grant execute on function public.disable_ville_push(text) to anon, authenticated;
