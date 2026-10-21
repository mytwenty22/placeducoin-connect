-- Durées de conservation annoncées dans la politique de confidentialité (art. 20 des CGU) :
-- tâche quotidienne pg_cron qui purge ou anonymise les données arrivées à échéance.
--
--   - Validations de coupons (promo_activations) : anonymisées au bout de 3 ans. Le lien avec le
--     compte (user_id) est effacé, la ligne reste pour les statistiques du commerçant (get_roi_stats).
--   - Tentatives de code PIN (pin_attempts) : journal anti-force brute qui ne sert que sur une
--     fenêtre de 15 minutes, supprimé au bout de 30 jours.
--   - Comptes particuliers inactifs depuis 3 ans (aucune connexion) : un e-mail de préavis est envoyé
--     (Edge Function notify-inactive-accounts), puis le compte est supprimé 30 jours plus tard s'il
--     ne s'est toujours pas reconnecté. Sans préavis envoyé, aucun compte n'est supprimé. Les comptes
--     Pro, Association, Mairie et Admin ne sont pas concernés : leurs données suivent le contrat
--     (art. 17 des CGV) ou l'habilitation de la commune.
--
-- La suppression d'un compte efface en cascade son profil, ses favoris, ses notifications, ses
-- validations de coupons non encore anonymisées et ses tentatives de PIN. Le journal
-- legal_acceptances n'a pas de clé étrangère et n'est pas touché (preuve, art. 17 des CGV).

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

alter table public.promo_activations alter column user_id drop not null;

-- Préavis de suppression envoyés (une ligne par compte prévenu, effacée s'il se reconnecte).
create table if not exists public.account_deletion_notices (
  user_id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  notified_at timestamptz not null default now()
);

alter table public.account_deletion_notices enable row level security;
revoke all on public.account_deletion_notices from anon, authenticated;

-- Comptes particuliers (ni rôle Pro/Association/Mairie/Admin, ni fiche) sans connexion depuis
-- p_before.
create or replace function public.inactive_particulier_accounts(p_before timestamptz)
returns table (user_id uuid, email text, last_activity timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select u.id, u.email::text, coalesce(u.last_sign_in_at, u.created_at)
  from auth.users u
  where coalesce(u.last_sign_in_at, u.created_at) < p_before
    and u.email is not null
    and not exists (
      select 1 from public.profiles p
      where p.id = u.id and p.role::text in ('pro', 'association', 'mairie', 'admin')
    )
    and not exists (select 1 from public.commerces c where c.owner_id = u.id);
$$;

-- Comptes à prévenir : inactifs depuis 3 ans moins 30 jours, pas encore prévenus. Lu par
-- notify-inactive-accounts avec la clé service_role.
create or replace function public.accounts_due_for_deletion_notice()
returns table (user_id uuid, email text, last_activity timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select a.user_id, a.email, a.last_activity
  from public.inactive_particulier_accounts(now() - interval '3 years' + interval '30 days') a
  where not exists (select 1 from public.account_deletion_notices n where n.user_id = a.user_id)
  order by a.last_activity
  limit 200;
$$;

create or replace function public.purge_expired_data()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_anonymized integer;
  v_pin_attempts integer;
  v_reactivated integer;
  v_deleted integer;
  v_key text;
begin
  update public.promo_activations
  set user_id = null
  where user_id is not null and created_at < now() - interval '3 years';
  get diagnostics v_anonymized = row_count;

  delete from public.pin_attempts where created_at < now() - interval '30 days';
  get diagnostics v_pin_attempts = row_count;

  -- Reconnecté depuis le préavis : le compte est conservé, le compteur repart de zéro.
  delete from public.account_deletion_notices n
  using auth.users u
  where u.id = n.user_id and u.last_sign_in_at > n.notified_at;
  get diagnostics v_reactivated = row_count;

  -- Préavis envoyé depuis au moins 30 jours, toujours inactif et toujours particulier.
  delete from auth.users u
  using public.account_deletion_notices n
  where n.user_id = u.id
    and n.notified_at < now() - interval '30 days'
    and u.id in (
      select a.user_id from public.inactive_particulier_accounts(now() - interval '3 years') a
    );
  get diagnostics v_deleted = row_count;

  -- Envoi des préavis par l'Edge Function (même clé Vault que les triggers d'alertes).
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key';
  if v_key is null then
    raise warning 'service_role_key absent de Vault -- préavis de suppression non envoyés';
  elsif exists (select 1 from public.accounts_due_for_deletion_notice()) then
    perform net.http_post(
      url := 'https://qerntkgpddlfiarmsyya.supabase.co/functions/v1/notify-inactive-accounts',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
      body := '{}'::jsonb
    );
  end if;

  return jsonb_build_object(
    'coupons_anonymized', v_anonymized,
    'pin_attempts_deleted', v_pin_attempts,
    'notices_cleared', v_reactivated,
    'accounts_deleted', v_deleted
  );
end;
$$;

revoke all on function public.inactive_particulier_accounts(timestamptz) from public, anon, authenticated;
revoke all on function public.accounts_due_for_deletion_notice() from public, anon, authenticated;
revoke all on function public.purge_expired_data() from public, anon, authenticated;
grant execute on function public.accounts_due_for_deletion_notice() to service_role;

-- Tous les jours à 3 h 30 (UTC).
select cron.unschedule(jobid) from cron.job where jobname = 'purge-expired-data';
select cron.schedule('purge-expired-data', '30 3 * * *', 'select public.purge_expired_data()');
