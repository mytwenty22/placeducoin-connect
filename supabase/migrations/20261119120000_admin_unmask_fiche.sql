-- Réaffichage d'une fiche masquée depuis /admin (cf. 20261119100000_commerces_masquage.sql).
-- Comme les autres actions admin : RPC security definer, pas de policy d'écriture admin sur commerces.

create or replace function public.admin_unmask_fiche(p_commerce_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Réservé aux administrateurs.' using errcode = '42501';
  end if;

  update public.commerces set masquee_at = null, masquage_motif = null
  where id = p_commerce_id;
  if not found then
    raise exception 'Fiche introuvable.' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.admin_unmask_fiche(uuid) from public, anon;
grant execute on function public.admin_unmask_fiche(uuid) to authenticated;
