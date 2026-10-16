-- Verrouillage des options payantes : seuls le webhook Stripe et les fonctions serveur
-- (service_role), les admins et le SQL editor peuvent les activer.
--
-- Avant cette migration, la policy "Un pro modifie sa fiche commerce" laissait un propriétaire
-- modifier n'importe quelle colonne de sa fiche, et la policy "Un pro reserve une banniere dans
-- sa zone" le laissait insérer une bannière : un appel direct à l'API (clé publique + son compte)
-- suffisait pour s'offrir Site Pro, Vedette ou une bannière sans passer par Stripe.
--
-- Ce qui reste permis à un propriétaire :
-- - désactiver son Vedette (boost_actif -> false), comme le bouton "Annuler l'option Vedette" ;
-- - annuler (active -> false) ou supprimer sa propre bannière.
-- L'annulation Site Pro passe déjà par la fonction cancel-subscription (service_role).

-- security invoker (pas definer) : current_user doit refléter l'appelant réel, comme dans
-- public.enforce_profile_identity.
create or replace function public.enforce_commerce_paid_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.site_actif := false;
    new.boost_actif := false;
    new.boost_expires_at := null;
    new.stripe_customer_id := null;
    new.stripe_subscription_id := null;
    new.google_rating := null;
    new.google_review_count := 0;
    return new;
  end if;

  if new.site_actif and not old.site_actif then
    raise exception 'Le Site Pro s''active uniquement via le paiement Stripe.' using errcode = '42501';
  end if;

  if new.boost_actif
    and (not old.boost_actif or new.boost_expires_at is distinct from old.boost_expires_at) then
    raise exception 'L''option Vedette s''active uniquement via le paiement Stripe.' using errcode = '42501';
  end if;

  if new.stripe_customer_id is distinct from old.stripe_customer_id
    or new.stripe_subscription_id is distinct from old.stripe_subscription_id
    or new.google_rating is distinct from old.google_rating
    or new.google_review_count is distinct from old.google_review_count then
    raise exception 'Ces champs ne sont pas modifiables depuis l''espace Pro.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_commerce_paid_fields on public.commerces;
create trigger trg_enforce_commerce_paid_fields
before insert or update on public.commerces
for each row execute function public.enforce_commerce_paid_fields();

-- Bannières : plus d'insertion directe par un pro. Une réservation n'est créée que par le
-- webhook Stripe après paiement (ou par un admin, via "Admin gere les banners").
drop policy if exists "Un pro reserve une banniere dans sa zone" on public.banners;

create or replace function public.enforce_banner_owner_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;

  -- Un pro peut seulement annuler sa réservation : aucune autre colonne ne doit bouger, et une
  -- bannière annulée ne peut pas être réactivée (ni sa période prolongée).
  if new.active and not old.active then
    raise exception 'Une bannière annulée ne peut pas être réactivée.' using errcode = '42501';
  end if;
  if (to_jsonb(new) - 'active') is distinct from (to_jsonb(old) - 'active') then
    raise exception 'Seule l''annulation d''une bannière est possible depuis l''espace Pro.'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_banner_owner_update on public.banners;
create trigger trg_enforce_banner_owner_update
before update on public.banners
for each row execute function public.enforce_banner_owner_update();
