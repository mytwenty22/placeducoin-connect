-- Lecture publique des villes (nécessaire pour afficher le nom de la commune)
alter table public.villes enable row level security;

create policy "Lecture publique villes"
on public.villes for select
using (true);

-- Un admin peut lire tous les profils (liste des comptes Mairie existants)
create policy "Admin lit tous les profils"
on public.profiles for select
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin'
  )
);
