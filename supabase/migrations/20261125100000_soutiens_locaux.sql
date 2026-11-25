-- Montants déclarés par les clients après la validation d'un coupon (« Valider mon soutien »).
-- Purement honorifique : alimente le compteur « Vous avez fait vivre les petits commerces… » de
-- /compte. Volontairement séparé de promo_activations.montant_estime, qui sert aux statistiques
-- de l'espace Pro et ne doit pas être influencé par une déclaration client.

create table if not exists public.soutiens_locaux (
  id uuid primary key default gen_random_uuid(),
  -- Une seule déclaration par validation de coupon. "set null" : le compteur du client survit à
  -- la suppression d'une fiche (cascade commerces → promo_activations).
  activation_id uuid unique references public.promo_activations (id) on delete set null,
  commerce_id uuid references public.commerces (id) on delete set null,
  user_id uuid not null references auth.users (id) on delete cascade,
  montant numeric(6, 2) not null check (montant > 0 and montant <= 500),
  created_at timestamptz not null default now()
);

create index if not exists soutiens_locaux_user_id_idx on public.soutiens_locaux (user_id);

alter table public.soutiens_locaux enable row level security;

-- Aucune policy d'écriture : les lignes ne sont créées que par declarer_soutien().
drop policy if exists "Un client lit ses propres soutiens" on public.soutiens_locaux;
create policy "Un client lit ses propres soutiens"
on public.soutiens_locaux for select
to authenticated
using (user_id = auth.uid());

create or replace function public.declarer_soutien(p_promo_id uuid, p_montant numeric)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_activation public.promo_activations%rowtype;
begin
  if v_user is null then
    raise exception 'Connexion requise.' using errcode = '42501';
  end if;
  if p_montant is null or p_montant <= 0 or p_montant > 500 then
    return jsonb_build_object('status', 'invalid_amount');
  end if;

  select * into v_activation
  from public.promo_activations
  where promo_id = p_promo_id and user_id = v_user;
  if not found then
    return jsonb_build_object('status', 'no_activation');
  end if;
  -- La question est posée juste après la validation : au-delà de 24 h, on ne l'accepte plus.
  if v_activation.created_at < now() - interval '24 hours' then
    return jsonb_build_object('status', 'too_late');
  end if;

  insert into public.soutiens_locaux (activation_id, commerce_id, user_id, montant)
  values (v_activation.id, v_activation.commerce_id, v_user, round(p_montant, 2))
  on conflict (activation_id) do nothing;
  if not found then
    return jsonb_build_object('status', 'already_declared');
  end if;

  return jsonb_build_object('status', 'saved');
end;
$$;

revoke all on function public.declarer_soutien(uuid, numeric) from public, anon;
grant execute on function public.declarer_soutien(uuid, numeric) to authenticated;
