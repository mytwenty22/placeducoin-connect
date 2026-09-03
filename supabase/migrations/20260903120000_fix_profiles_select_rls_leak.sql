-- CRITICAL SECURITY FIX: a QA audit found that an anonymous (anon key) client could read every
-- row of public.profiles — including every user's UUID and which one holds the 'admin' role —
-- even though the intended policies restrict SELECT to a user's own row (or to admins). RLS
-- enforcement on INSERT was confirmed intact (anon inserts are correctly rejected), so this is
-- an overly-permissive SELECT policy, not RLS being disabled on the table. This migration removes
-- every existing SELECT policy on profiles and recreates only the two intended ones, so any
-- rogue policy added outside of tracked migrations (e.g. via the dashboard) is removed too.

alter table public.profiles enable row level security;

do $$
declare
  pol record;
begin
  for pol in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'profiles' and cmd = 'SELECT'
  loop
    execute format('drop policy if exists %I on public.profiles', pol.policyname);
  end loop;
end $$;

create policy "Un utilisateur lit son propre profil"
on public.profiles for select
to authenticated
using (id = auth.uid());

create policy "Admin lit tous les profils"
on public.profiles for select
to authenticated
using (public.is_admin());
