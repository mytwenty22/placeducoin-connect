-- Création de fiches sans gérant depuis /admin (formulaire ou import CSV d'une commune). Elles
-- apparaissent sur la marketplace et proposent la revendication (claimed = false, owner_id null).
--
-- Tout ou rien : à la première ligne invalide, aucune fiche n'est créée. Une fiche déjà présente
-- dans la commune (même nom, même adresse) est ignorée, pour pouvoir relancer un même fichier.

create or replace function public.admin_create_unclaimed_fiches(p_ville_id uuid, p_fiches jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fiche jsonb;
  v_nom text;
  v_adresse text;
  v_telephone text;
  v_category text;
  v_base_slug text;
  v_slug text;
  v_suffix integer;
  v_created integer := 0;
  v_skipped jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.villes where id = p_ville_id) then
    raise exception 'Commune introuvable.' using errcode = 'P0002';
  end if;
  if jsonb_typeof(p_fiches) <> 'array' or jsonb_array_length(p_fiches) > 500 then
    raise exception 'Import limité à 500 fiches.' using errcode = '22023';
  end if;

  for v_fiche in select * from jsonb_array_elements(p_fiches) loop
    v_nom := btrim(coalesce(v_fiche->>'nom', ''));
    v_adresse := btrim(coalesce(v_fiche->>'adresse', ''));
    v_telephone := btrim(coalesce(v_fiche->>'telephone', ''));
    v_category := v_fiche->>'category';

    if char_length(v_nom) not between 2 and 80 then
      raise exception 'Nom invalide : « % ».', v_nom using errcode = '22023';
    end if;
    if char_length(v_adresse) not between 3 and 200 then
      raise exception 'Adresse invalide pour « % ».', v_nom using errcode = '22023';
    end if;
    if char_length(v_telephone) not between 6 and 30 then
      raise exception 'Téléphone invalide pour « % ».', v_nom using errcode = '22023';
    end if;
    if v_category is null or v_category not in ('bouche', 'boutiques', 'services') then
      raise exception 'Catégorie invalide pour « % ».', v_nom using errcode = '22023';
    end if;
    if coalesce(v_fiche->>'code_postal', '') !~ '^[0-9]{5}$' then
      raise exception 'Code postal invalide pour « % ».', v_nom using errcode = '22023';
    end if;

    if exists (
      select 1 from public.commerces
      where ville_id = p_ville_id
        and lower(btrim(nom)) = lower(v_nom)
        and lower(btrim(coalesce(adresse, ''))) = lower(v_adresse)
    ) then
      v_skipped := v_skipped || to_jsonb(v_nom);
      continue;
    end if;

    v_base_slug := coalesce(nullif(v_fiche->>'slug', ''), 'commerce');
    v_slug := v_base_slug;
    v_suffix := 1;
    while exists (select 1 from public.commerces where slug = v_slug) loop
      v_suffix := v_suffix + 1;
      v_slug := v_base_slug || '-' || v_suffix;
    end loop;

    insert into public.commerces (
      owner_id, claimed, ville_id, quartier_id, slug, nom, trade, category, adresse, code_postal,
      telephone, latitude, longitude
    )
    values (
      null, false, p_ville_id, nullif(v_fiche->>'quartier_id', '')::uuid, v_slug, v_nom,
      btrim(coalesce(v_fiche->>'trade', '')), v_category, v_adresse, v_fiche->>'code_postal',
      v_telephone, (v_fiche->>'latitude')::double precision,
      (v_fiche->>'longitude')::double precision
    );
    v_created := v_created + 1;
  end loop;

  return jsonb_build_object('created', v_created, 'skipped', v_skipped);
end;
$$;

revoke all on function public.admin_create_unclaimed_fiches(uuid, jsonb) from public, anon;
grant execute on function public.admin_create_unclaimed_fiches(uuid, jsonb) to authenticated;
