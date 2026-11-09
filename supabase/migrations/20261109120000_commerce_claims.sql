-- Revendication de fiches : une fiche sans gérant (claimed = false) peut être réclamée depuis sa
-- page publique, et un admin rattache le compte du commerçant à la fiche.
--
-- - is_demo masque une fiche de la marketplace ; aucune fiche existante n'est marquée ici.
-- - Toute écriture sensible passe par des RPC security definer : les demandes ne sont pas
--   modifiables directement, et claimed / is_demo / owner_id sont verrouillés côté client.

alter table public.commerces add column if not exists claimed boolean not null default false;
alter table public.commerces add column if not exists is_demo boolean not null default false;

-- Une fiche à revendiquer n'a pas encore de titulaire.
alter table public.commerces alter column owner_id drop not null;

-- Les fiches existantes ont toutes un titulaire : elles ne doivent pas proposer la revendication.
update public.commerces set claimed = true where owner_id is not null and not claimed;

create or replace function public.enforce_commerce_claim_fields()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('authenticated', 'anon') or public.is_admin() then
    return new;
  end if;

  -- Fiche créée par son commerçant depuis l'Espace Pro : elle est déjà la sienne.
  if tg_op = 'INSERT' then
    new.claimed := new.owner_id is not null;
    new.is_demo := false;
    return new;
  end if;

  if new.claimed is distinct from old.claimed
    or new.is_demo is distinct from old.is_demo
    or new.owner_id is distinct from old.owner_id then
    raise exception 'Ces champs ne sont pas modifiables depuis l''espace Pro.' using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_commerce_claim_fields on public.commerces;
create trigger trg_enforce_commerce_claim_fields
before insert or update on public.commerces
for each row execute function public.enforce_commerce_claim_fields();

create table if not exists public.claim_requests (
  id uuid primary key default gen_random_uuid(),
  commerce_id uuid not null references public.commerces (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  contact_name text not null check (char_length(contact_name) between 2 and 120),
  phone text not null check (char_length(phone) between 6 and 30),
  siret text not null check (siret ~ '^[0-9]{14}$'),
  message text check (message is null or char_length(message) <= 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users (id) on delete set null
);

create unique index if not exists claim_requests_one_pending_per_user
on public.claim_requests (commerce_id, user_id)
where status = 'pending';

alter table public.claim_requests enable row level security;
revoke all on public.claim_requests from anon, authenticated;
grant select on public.claim_requests to authenticated;

drop policy if exists "Lecture de ses demandes de revendication" on public.claim_requests;
create policy "Lecture de ses demandes de revendication"
on public.claim_requests for select
to authenticated
using (user_id = auth.uid());

create or replace function public.submit_claim_request(
  p_commerce_id uuid,
  p_contact_name text,
  p_phone text,
  p_siret text,
  p_message text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_commerce public.commerces%rowtype;
  v_name text := btrim(coalesce(p_contact_name, ''));
  v_phone text := btrim(coalesce(p_phone, ''));
  v_siret text := regexp_replace(coalesce(p_siret, ''), '\s', '', 'g');
  v_message text := nullif(btrim(coalesce(p_message, '')), '');
begin
  if v_uid is null then
    raise exception 'Connectez-vous pour revendiquer cette fiche.' using errcode = '42501';
  end if;
  if char_length(v_name) not between 2 and 120 then
    raise exception 'Indiquez votre nom et prénom.' using errcode = '22023';
  end if;
  if char_length(v_phone) not between 6 and 30 then
    raise exception 'Indiquez un numéro de téléphone valide.' using errcode = '22023';
  end if;
  if v_siret !~ '^[0-9]{14}$' then
    raise exception 'Le SIRET doit comporter 14 chiffres.' using errcode = '22023';
  end if;
  if char_length(coalesce(v_message, '')) > 1000 then
    raise exception 'Le message ne doit pas dépasser 1000 caractères.' using errcode = '22023';
  end if;

  select * into v_commerce from public.commerces where id = p_commerce_id;
  if not found or v_commerce.suspended_at is not null or v_commerce.is_demo then
    raise exception 'Cette fiche ne peut pas être revendiquée.' using errcode = '42501';
  end if;
  if v_commerce.claimed then
    raise exception 'Cette fiche a déjà un gérant.' using errcode = '42501';
  end if;
  if exists (select 1 from public.commerces where owner_id = v_uid) then
    raise exception 'Votre compte gère déjà une fiche.' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.claim_requests
    where commerce_id = p_commerce_id and user_id = v_uid and status = 'pending'
  ) then
    raise exception 'Votre demande est déjà en cours d''examen.' using errcode = '23505';
  end if;

  insert into public.claim_requests (commerce_id, user_id, contact_name, phone, siret, message)
  values (p_commerce_id, v_uid, v_name, v_phone, v_siret, v_message);
end;
$$;

create or replace function public.admin_list_claim_requests()
returns table (
  request_id uuid,
  commerce_id uuid,
  commerce_nom text,
  commerce_slug text,
  commerce_adresse text,
  ville_nom text,
  user_email text,
  contact_name text,
  phone text,
  siret text,
  message text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs.' using errcode = '42501';
  end if;

  return query
  select
    r.id, c.id, c.nom, c.slug, c.adresse, v.nom, u.email::text, r.contact_name, r.phone, r.siret,
    r.message, r.created_at
  from public.claim_requests r
  join public.commerces c on c.id = r.commerce_id
  left join public.villes v on v.id = c.ville_id
  left join auth.users u on u.id = r.user_id
  where r.status = 'pending'
  order by r.created_at asc;
end;
$$;

create or replace function public.admin_approve_claim_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.claim_requests%rowtype;
  v_claimed boolean;
  v_role text;
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs.' using errcode = '42501';
  end if;

  select * into v_request from public.claim_requests where id = p_request_id for update;
  if not found or v_request.status <> 'pending' then
    raise exception 'Cette demande n''est plus en attente.' using errcode = 'P0002';
  end if;

  select claimed into v_claimed from public.commerces where id = v_request.commerce_id for update;
  if v_claimed then
    raise exception 'Cette fiche a déjà un gérant.' using errcode = '42501';
  end if;
  if exists (select 1 from public.commerces where owner_id = v_request.user_id) then
    raise exception 'Ce compte gère déjà une fiche.' using errcode = '42501';
  end if;

  select role::text into v_role from public.profiles where id = v_request.user_id;
  if v_role in ('admin', 'mairie', 'association') then
    raise exception 'Ce type de compte ne peut pas gérer une fiche commerce.' using errcode = '42501';
  end if;

  -- L'Espace Pro est réservé au rôle pro : un compte client doit l'obtenir pour gérer sa fiche.
  insert into public.profiles (id, role) values (v_request.user_id, 'pro')
  on conflict (id) do update set role = 'pro';

  update public.commerces
  set owner_id = v_request.user_id, claimed = true
  where id = v_request.commerce_id;

  update public.claim_requests
  set status = 'approved', reviewed_at = now(), reviewed_by = auth.uid()
  where id = p_request_id;

  -- La fiche a désormais son gérant : les demandes concurrentes tombent.
  update public.claim_requests
  set status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid()
  where commerce_id = v_request.commerce_id and status = 'pending';
end;
$$;

create or replace function public.admin_reject_claim_request(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs.' using errcode = '42501';
  end if;

  update public.claim_requests
  set status = 'rejected', reviewed_at = now(), reviewed_by = auth.uid()
  where id = p_request_id and status = 'pending';
  if not found then
    raise exception 'Cette demande n''est plus en attente.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.submit_claim_request(uuid, text, text, text, text) from public, anon;
revoke all on function public.admin_list_claim_requests() from public, anon;
revoke all on function public.admin_approve_claim_request(uuid) from public, anon;
revoke all on function public.admin_reject_claim_request(uuid) from public, anon;
grant execute on function public.submit_claim_request(uuid, text, text, text, text) to authenticated;
grant execute on function public.admin_list_claim_requests() to authenticated;
grant execute on function public.admin_approve_claim_request(uuid) to authenticated;
grant execute on function public.admin_reject_claim_request(uuid) to authenticated;
