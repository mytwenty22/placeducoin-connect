-- Recherche de commerces par nom sur toute la table (marketplace PC et mobile), insensible à la
-- casse et aux accents : « maison m », « La Maison M » ou « boucherie b » trouvent la fiche même
-- si elle est hors du rayon GPS, d'un autre quartier ou d'une autre commune.
-- security invoker : les policies de lecture de commerces s'appliquent (fiches suspendues ou
-- masquées exclues pour le public). Renvoie seulement des identifiants ; le client relit les
-- fiches avec ses colonnes habituelles (promos embarquées comprises).

create extension if not exists unaccent with schema extensions;

create or replace function public.search_commerces(p_query text, p_limit integer default 100)
returns table (id uuid)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with q as (
    select
      '%' || replace(replace(replace(
        extensions.unaccent(lower(btrim(coalesce(p_query, '')))),
        '\', '\\'), '%', '\%'), '_', '\_') || '%' as pattern,
      length(btrim(coalesce(p_query, ''))) as len
  )
  select c.id
  from public.commerces c, q
  where q.len >= 2
    and c.is_demo = false
    and extensions.unaccent(lower(c.nom)) ilike q.pattern
  order by c.nom
  limit least(greatest(coalesce(p_limit, 100), 1), 200);
$$;

revoke all on function public.search_commerces(text, integer) from public;
grant execute on function public.search_commerces(text, integer) to anon, authenticated;
