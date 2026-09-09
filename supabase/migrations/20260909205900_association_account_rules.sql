-- Association accounts: their commerce card always lands in the "Vie Locale & Mairie" tab
-- (category = 'locale'), and they only ever publish events, never a promo/arrivage. Two things
-- were needed beyond the account type itself, both pre-dating this feature:
--
-- 1. commerces.category's check constraint only ever allowed ('bouche','services','boutiques') —
--    'locale' was never a legal value, even though the category picker has offered "Vie Locale &
--    Mairie" since day one. Widened here.
-- 2. The commerces insert policy only allowed role = 'pro', blocking association accounts from
--    creating a fiche at all. Now allows either role.
--
-- Category/kind enforcement uses triggers (not just check constraints) because both rules depend
-- on the owning profile's role in another table.

alter table public.commerces drop constraint if exists commerces_category_check;
alter table public.commerces add constraint commerces_category_check
  check (category in ('bouche', 'services', 'boutiques', 'locale'));

drop policy if exists "Un pro crée sa fiche commerce" on public.commerces;
drop policy if exists "Un pro ou une association crée sa fiche" on public.commerces;
create policy "Un pro ou une association crée sa fiche"
on public.commerces for insert
to authenticated
with check (
  owner_id = auth.uid()
  and exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('pro', 'association')
  )
);

create or replace function public.enforce_association_commerce_category()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.profiles p where p.id = new.owner_id and p.role = 'association'
  ) then
    new.category := 'locale';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_association_commerce_category on public.commerces;
create trigger trg_enforce_association_commerce_category
before insert or update on public.commerces
for each row execute function public.enforce_association_commerce_category();

create or replace function public.enforce_association_promo_kind()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1
    from public.commerces c
    join public.profiles p on p.id = c.owner_id
    where c.id = new.commerce_id and p.role = 'association'
  ) then
    new.kind := 'evenement';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_enforce_association_promo_kind on public.promos;
create trigger trg_enforce_association_promo_kind
before insert or update on public.promos
for each row execute function public.enforce_association_promo_kind();
