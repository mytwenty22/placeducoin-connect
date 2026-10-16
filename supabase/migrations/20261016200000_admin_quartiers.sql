-- Modération des quartiers depuis /admin.
--
-- La suppression passe par la policy "Admin gere les quartiers" (les fiches rattachées
-- repassent à quartier_id null via on delete set null). Renommer et fusionner passent par ces
-- deux RPC : le slug est recalculé par public.quartier_slug comme dans add_quartier, et la
-- fusion déplace les fiches avant de supprimer le doublon, dans une seule transaction.

create or replace function public.admin_rename_quartier(p_quartier_id uuid, p_nom text)
returns public.quartiers
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_nom text := btrim(regexp_replace(coalesce(p_nom, ''), '\s+', ' ', 'g'));
  clean_slug text := public.quartier_slug(clean_nom);
  current_row public.quartiers;
  result public.quartiers;
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs.' using errcode = '42501';
  end if;

  if char_length(clean_nom) < 2 or char_length(clean_nom) > 60 or clean_slug = '' then
    raise exception 'Nom de quartier invalide (2 à 60 caractères).' using errcode = '22023';
  end if;

  select * into current_row from public.quartiers where id = p_quartier_id;
  if not found then
    raise exception 'Quartier introuvable.' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.quartiers
    where ville_id = current_row.ville_id and slug = clean_slug and id <> p_quartier_id
  ) then
    raise exception 'Un quartier porte déjà ce nom dans cette ville : fusionnez-les plutôt.'
      using errcode = '23505';
  end if;

  update public.quartiers set nom = clean_nom, slug = clean_slug
  where id = p_quartier_id
  returning * into result;
  return result;
end;
$$;

create or replace function public.admin_merge_quartier(p_source_id uuid, p_target_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  source_ville uuid;
  target_ville uuid;
  moved integer;
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs.' using errcode = '42501';
  end if;

  if p_source_id = p_target_id then
    raise exception 'Choisissez un autre quartier.' using errcode = '22023';
  end if;

  select ville_id into source_ville from public.quartiers where id = p_source_id;
  select ville_id into target_ville from public.quartiers where id = p_target_id;
  if source_ville is null or target_ville is null then
    raise exception 'Quartier introuvable.' using errcode = 'P0002';
  end if;
  if source_ville <> target_ville then
    raise exception 'Les deux quartiers doivent être dans la même ville.' using errcode = '22023';
  end if;

  update public.commerces set quartier_id = p_target_id where quartier_id = p_source_id;
  get diagnostics moved = row_count;

  delete from public.quartiers where id = p_source_id;
  return moved;
end;
$$;

revoke all on function public.admin_rename_quartier(uuid, text) from public, anon;
revoke all on function public.admin_merge_quartier(uuid, uuid) from public, anon;
grant execute on function public.admin_rename_quartier(uuid, text) to authenticated;
grant execute on function public.admin_merge_quartier(uuid, uuid) to authenticated;
