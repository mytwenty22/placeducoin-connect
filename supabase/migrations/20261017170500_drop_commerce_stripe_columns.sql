-- Étape 2 sur 2 (voir 20261017170000_commerce_billing.sql) : suppression des identifiants Stripe
-- de la table publique commerces, une fois les fonctions Stripe passées sur commerce_billing.
--
-- Le trigger de verrouillage des options payantes ne mentionne plus ces colonnes : elles sont
-- désormais hors de portée d'un propriétaire (table commerce_billing sans aucun droit client).

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

  if new.google_rating is distinct from old.google_rating
    or new.google_review_count is distinct from old.google_review_count then
    raise exception 'Ces champs ne sont pas modifiables depuis l''espace Pro.' using errcode = '42501';
  end if;

  return new;
end;
$$;

alter table public.commerces drop column if exists stripe_customer_id;
alter table public.commerces drop column if exists stripe_subscription_id;
