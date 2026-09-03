-- La policy précédente interrogeait profiles depuis une policy sur profiles,
-- ce qui déclenche "infinite recursion detected in policy for relation profiles" (42P17).
-- On passe par une fonction SECURITY DEFINER : exécutée avec les droits du propriétaire
-- (postgres), elle contourne la RLS pour cette seule vérification et casse la boucle.
drop policy if exists "Admin lit tous les profils" on public.profiles;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

create policy "Admin lit tous les profils"
on public.profiles for select
to authenticated
using (public.is_admin());
