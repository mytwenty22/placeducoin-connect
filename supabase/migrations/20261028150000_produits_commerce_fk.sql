-- La clé étrangère produits.commerce_id -> commerces.id, déclarée par
-- 20260907163000_replace_legacy_produits_table.sql, n'existait pas en production : un produit
-- pouvait viser une fiche inexistante et la suppression d'une fiche laissait ses produits en
-- place (un produit de test orphelin a été supprimé à la main le 2026-10-28 avant cette
-- migration).
--
-- Garde-fou pour une base où des orphelins seraient réapparus d'ici l'application : on les
-- supprime, sinon l'ajout de la contrainte échouerait.

delete from public.produits p
where not exists (select 1 from public.commerces c where c.id = p.commerce_id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.produits'::regclass
      and contype = 'f'
      and confrelid = 'public.commerces'::regclass
  ) then
    alter table public.produits
      add constraint produits_commerce_id_fkey
      foreign key (commerce_id) references public.commerces (id) on delete cascade;
  end if;
end;
$$;
