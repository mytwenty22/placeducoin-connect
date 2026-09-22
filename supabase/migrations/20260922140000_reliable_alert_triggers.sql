-- Fiabilise le déclenchement des alertes e-mail : l'appel best-effort côté client juste après
-- l'insert (src/routes/pro.tsx, src/routes/mairie.tsx) ne garantit rien -- bloqueur de pub, onglet
-- fermé trop tôt, erreur réseau silencieuse. Un trigger Postgres appelle désormais directement les
-- Edge Functions après chaque insertion, côté serveur, sans dépendre du client.
create extension if not exists pg_net with schema extensions;

-- La clé service_role est lue depuis Vault (jamais en clair dans une définition de fonction, lisible
-- par quiconque a accès au catalogue système). Le secret nommé 'service_role_key' doit être créé une
-- fois, manuellement, depuis l'éditeur SQL Supabase :
--   select vault.create_secret('<service_role key -- Project Settings -> API>', 'service_role_key');
-- Tant qu'il n'existe pas, les fonctions ci-dessous se contentent d'un avertissement (aucune casse).
create or replace function public.trigger_promo_alert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
begin
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key';
  if v_key is null then
    raise warning 'service_role_key absent de Vault -- alerte promo non envoyée pour %', new.id;
    return new;
  end if;
  perform net.http_post(
    url := 'https://qerntkgpddlfiarmsyya.supabase.co/functions/v1/send-promo-alerts',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body := jsonb_build_object('promoId', new.id)
  );
  return new;
end;
$$;

drop trigger if exists promo_alert_trigger on public.promos;
create trigger promo_alert_trigger
after insert on public.promos
for each row execute function public.trigger_promo_alert();

create or replace function public.trigger_mairie_alert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
begin
  select decrypted_secret into v_key from vault.decrypted_secrets where name = 'service_role_key';
  if v_key is null then
    raise warning 'service_role_key absent de Vault -- alerte mairie non envoyée pour %', new.id;
    return new;
  end if;
  perform net.http_post(
    url := 'https://qerntkgpddlfiarmsyya.supabase.co/functions/v1/send-mairie-alerts',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_key),
    body := jsonb_build_object('infoId', new.id)
  );
  return new;
end;
$$;

drop trigger if exists mairie_alert_trigger on public."Infos_Mairie";
create trigger mairie_alert_trigger
after insert on public."Infos_Mairie"
for each row execute function public.trigger_mairie_alert();
