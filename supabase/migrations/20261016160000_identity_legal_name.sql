-- Vérification automatique SIRET/RNA (supabase/functions/verify-identity) : on garde la
-- dénomination officielle renvoyée par recherche-entreprises.api.gouv.fr, pour pouvoir repérer
-- un compte qui utiliserait le SIRET d'une autre entreprise. Comme verification_status, elle n'est
-- jamais modifiable par l'utilisateur : enforce_profile_identity est redéfinie pour la protéger.

alter table public.profiles add column if not exists legal_name text;

create or replace function public.enforce_profile_identity()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  privileged boolean := current_user not in ('authenticated', 'anon') or public.is_admin();
begin
  new.entity_type := case new.role
    when 'pro' then 'company'
    when 'association' then 'association'
    else null
  end;

  if new.entity_type is distinct from 'company' or new.siret is not null then
    new.immatriculation_en_cours := false;
  end if;

  if tg_op = 'UPDATE' and new.role is distinct from old.role and not privileged then
    raise exception 'Le type de compte ne peut pas être modifié.' using errcode = '42501';
  end if;

  if not privileged then
    if tg_op = 'INSERT'
      or new.siret is distinct from old.siret
      or new.rna is distinct from old.rna then
      new.verification_status := case
        when new.siret is null and new.rna is null then 'non_renseigne'
        else 'a_verifier'
      end;
      new.verified_at := null;
      new.legal_name := null;
    else
      new.verification_status := old.verification_status;
      new.verified_at := old.verified_at;
      new.legal_name := old.legal_name;
    end if;
  end if;

  return new;
end;
$$;
