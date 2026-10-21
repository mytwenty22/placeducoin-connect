-- Preuve d'acceptation des documents juridiques (CGU/CGV Espace Pro, Charte Espace Mairies).
--
-- Jusqu'ici l'acceptation n'était tracée que dans les métadonnées du compte (auth.users
-- raw_user_meta_data), que l'utilisateur peut réécrire à tout moment avec auth.updateUser. Ce
-- journal la remplace comme preuve (art. 21 des CGV, art. 1 de la Charte) :
--   - une ligne par acceptation, jamais modifiée ni supprimée par les utilisateurs (aucune policy
--     insert/update/delete, écriture uniquement par record_legal_acceptance et le trigger
--     d'inscription, en SECURITY DEFINER) ;
--   - date fixée par le serveur (now()), pas par le navigateur ;
--   - adresse IP et navigateur repris des en-têtes de la requête PostgREST ;
--   - pas de clé étrangère vers auth.users ni d'effacement en cascade : la preuve survit à la
--     suppression du compte (durée du contrat + prescription, art. 17 des CGV). L'e-mail et le
--     nom de l'établissement ou de la commune sont copiés au moment de l'acceptation.

create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  email text,
  document text not null check (document in ('cgv-pro', 'charte-mairies')),
  version text not null check (length(version) between 1 and 40),
  accepted_at timestamptz not null default now(),
  -- 'signup' : case cochée à l'inscription Pro (copiée par le trigger) ; 'app' : case cochée
  -- dans l'application connectée ; 'metadata_backfill' : reprise des métadonnées existantes.
  source text not null check (source in ('signup', 'app', 'metadata_backfill')),
  commerce_id uuid references public.commerces (id) on delete set null,
  ville_id uuid references public.villes (id) on delete set null,
  -- Établissement (CGV) ou commune (Charte) au nom duquel l'utilisateur a accepté.
  subject text,
  ip_address text,
  user_agent text
);

create index if not exists legal_acceptances_user_document_idx
  on public.legal_acceptances (user_id, document, accepted_at desc);

alter table public.legal_acceptances enable row level security;

revoke all on public.legal_acceptances from anon, authenticated;
grant select on public.legal_acceptances to authenticated;

drop policy if exists "Lecture de ses propres acceptations" on public.legal_acceptances;
create policy "Lecture de ses propres acceptations"
on public.legal_acceptances for select
to authenticated
using (user_id = auth.uid() or public.is_admin());

-- Enregistre l'acceptation par l'utilisateur connecté. L'établissement (CGV) ou la commune
-- (Charte) est déduit du compte, jamais fourni par le navigateur.
create or replace function public.record_legal_acceptance(p_document text, p_version text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_headers json := nullif(current_setting('request.headers', true), '')::json;
  v_commerce_id uuid;
  v_ville_id uuid;
  v_subject text;
begin
  if v_uid is null then
    raise exception 'Connectez-vous pour accepter ce document.' using errcode = '42501';
  end if;

  if p_document = 'cgv-pro' then
    select id, nom into v_commerce_id, v_subject from public.commerces where owner_id = v_uid;
  elsif p_document = 'charte-mairies' then
    select p.ville_id, v.nom into v_ville_id, v_subject
    from public.profiles p
    left join public.villes v on v.id = p.ville_id
    where p.id = v_uid;
  end if;

  insert into public.legal_acceptances (
    user_id, email, document, version, source, commerce_id, ville_id, subject, ip_address, user_agent
  )
  values (
    v_uid,
    (select email from auth.users where id = v_uid),
    p_document,
    p_version,
    'app',
    v_commerce_id,
    v_ville_id,
    v_subject,
    -- Première adresse de X-Forwarded-For : celle du client, les suivantes sont les proxys.
    nullif(trim(split_part(v_headers ->> 'x-forwarded-for', ',', 1)), ''),
    left(v_headers ->> 'user-agent', 500)
  );
end;
$$;

revoke all on function public.record_legal_acceptance(text, text) from public, anon;
grant execute on function public.record_legal_acceptance(text, text) to authenticated;

-- Inscription Pro : la case est cochée avant la création du compte, sans session (confirmation
-- par e-mail). Le formulaire envoie la version acceptée dans les métadonnées d'inscription ; ce
-- trigger la copie dans le journal avec l'heure du serveur.
create or replace function public.record_signup_legal_acceptance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.raw_user_meta_data ->> 'pro_terms_version', '') <> '' then
    insert into public.legal_acceptances (user_id, email, document, version, source)
    values (
      new.id,
      new.email,
      'cgv-pro',
      left(new.raw_user_meta_data ->> 'pro_terms_version', 40),
      'signup'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_legal_acceptance on auth.users;
create trigger on_auth_user_created_legal_acceptance
  after insert on auth.users
  for each row execute function public.record_signup_legal_acceptance();

-- Reprise des acceptations déjà tracées dans les métadonnées (avant ce journal).
insert into public.legal_acceptances (user_id, email, document, version, accepted_at, source, subject)
select
  u.id,
  u.email,
  'cgv-pro',
  left(u.raw_user_meta_data ->> 'pro_terms_version', 40),
  coalesce((u.raw_user_meta_data ->> 'pro_terms_accepted_at')::timestamptz, u.created_at),
  'metadata_backfill',
  u.raw_user_meta_data ->> 'pro_terms_etablissement'
from auth.users u
where coalesce(u.raw_user_meta_data ->> 'pro_terms_version', '') <> ''
  and not exists (
    select 1 from public.legal_acceptances a where a.user_id = u.id and a.document = 'cgv-pro'
  );

insert into public.legal_acceptances (user_id, email, document, version, accepted_at, source, ville_id)
select
  u.id,
  u.email,
  'charte-mairies',
  left(u.raw_user_meta_data ->> 'charte_mairies_version', 40),
  coalesce((u.raw_user_meta_data ->> 'charte_mairies_accepted_at')::timestamptz, u.created_at),
  'metadata_backfill',
  p.ville_id
from auth.users u
left join public.profiles p on p.id = u.id
where coalesce(u.raw_user_meta_data ->> 'charte_mairies_version', '') <> ''
  and not exists (
    select 1 from public.legal_acceptances a
    where a.user_id = u.id and a.document = 'charte-mairies'
  );
