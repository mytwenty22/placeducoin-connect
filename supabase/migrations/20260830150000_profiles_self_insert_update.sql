-- La table profiles n'avait qu'une policy SELECT : aucun utilisateur authentifié ne pouvait
-- créer ni mettre à jour sa propre ligne, ce qui fait échouer l'upsert profiles côté /pro
-- avec une erreur RLS ("new row violates row-level security policy").
--
-- On autorise un utilisateur à insérer/modifier SA PROPRE ligne (auth.uid() = id), mais en
-- verrouillant le rôle à 'pro' : l'auto-inscription ne doit jamais permettre de s'attribuer
-- soi-même le rôle 'mairie' ou 'admin' (ces comptes restent provisionnés côté serveur via
-- src/lib/mairie-admin.ts / bootstrap manuel).
create policy "Un utilisateur cree son propre profil pro"
on public.profiles for insert
to authenticated
with check (id = auth.uid() and role = 'pro');

create policy "Un utilisateur modifie son propre profil pro"
on public.profiles for update
to authenticated
using (id = auth.uid() and role = 'pro')
with check (id = auth.uid() and role = 'pro');
