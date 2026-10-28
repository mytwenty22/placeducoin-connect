-- Vérifications de comportement après rejeu des migrations. Chaque bloc écrit un résultat dans
-- check_results ; les erreurs attendues sont rattrapées.
create table public.check_results (name text, ok boolean, detail text);
grant all on public.check_results to authenticated;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'attaquant@test'),
  ('00000000-0000-0000-0000-00000000000b', 'pro@test'),
  ('00000000-0000-0000-0000-00000000000c', 'autre@test');
insert into public.villes (id, nom, slug) values ('00000000-0000-0000-0000-0000000000f1', 'Testville', 'testville');

-- 1. Un utilisateur ne peut pas se créer un profil admin.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', false);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
do $$ begin
  insert into public.profiles (id, role) values ('00000000-0000-0000-0000-00000000000a', 'admin');
  insert into public.check_results values ('profil admin refusé', false, 'insertion acceptée');
exception when others then
  insert into public.check_results values ('profil admin refusé', true, sqlerrm);
end $$;

-- 2. Un utilisateur peut toujours créer et modifier son profil pro (upsert de l'inscription).
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', false);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$ begin
  insert into public.profiles (id, role) values ('00000000-0000-0000-0000-00000000000b', 'pro')
    on conflict (id) do update set role = excluded.role;
  insert into public.profiles (id, role) values ('00000000-0000-0000-0000-00000000000b', 'pro')
    on conflict (id) do update set siret = '73282932000074';
  insert into public.check_results values ('profil pro créé puis modifié', true,
    (select siret from public.profiles where id = '00000000-0000-0000-0000-00000000000b'));
exception when others then
  insert into public.check_results values ('profil pro créé puis modifié', false, sqlerrm);
end $$;
reset role;

-- Fixtures : un commerce et une bannière du pro b.
insert into public.commerces (id, owner_id, ville_id, slug, nom, trade, category, site_actif)
values ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000000b',
        '00000000-0000-0000-0000-0000000000f1', 'test-shop', 'Test Shop', 'Boulangerie', 'bouche', true);
insert into public.banners (id, city_slug, image_url, commerce_id, position, tier, active)
values ('00000000-0000-0000-0000-0000000000b1', 'testville', 'https://x/img.png',
        '00000000-0000-0000-0000-0000000000c1', 'top', 'standard', true);

-- 3. Le pro annule sa bannière ; un autre compte ne peut pas.
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}', false);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000c', false);
update public.banners set active = false where id = '00000000-0000-0000-0000-0000000000b1';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', false);
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
insert into public.check_results values ('bannière intacte après tentative d''un tiers', true, null);
reset role;
update public.check_results set ok = (select active from public.banners where id = '00000000-0000-0000-0000-0000000000b1')
  where name = 'bannière intacte après tentative d''un tiers';
set role authenticated;
update public.banners set active = false where id = '00000000-0000-0000-0000-0000000000b1';
reset role;
insert into public.check_results values ('bannière annulée par son pro',
  (select not active from public.banners where id = '00000000-0000-0000-0000-0000000000b1'), null);

-- 4. Le pro (Site Pro) ajoute un produit sans prix.
set role authenticated;
do $$ begin
  insert into public.produits (commerce_id, nom, prix) values ('00000000-0000-0000-0000-0000000000c1', 'Sans prix', null);
  insert into public.check_results values ('produit sans prix accepté', true, null);
exception when others then
  insert into public.check_results values ('produit sans prix accepté', false, sqlerrm);
end $$;
reset role;

-- 5. Catégorie invalide refusée.
do $$ begin
  update public.commerces set category = 'nimporte' where id = '00000000-0000-0000-0000-0000000000c1';
  insert into public.check_results values ('catégorie invalide refusée', false, 'acceptée');
exception when check_violation then
  insert into public.check_results values ('catégorie invalide refusée', true, sqlerrm);
end $$;

-- 6. Supprimer la fiche supprime ses bannières et ses produits.
delete from public.commerces where id = '00000000-0000-0000-0000-0000000000c1';
insert into public.check_results values ('suppression en cascade',
  not exists (select 1 from public.banners where id = '00000000-0000-0000-0000-0000000000b1')
  and not exists (select 1 from public.produits where nom = 'Sans prix'), null);

select * from public.check_results;
