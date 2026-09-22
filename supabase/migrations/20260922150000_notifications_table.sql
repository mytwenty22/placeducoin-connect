-- Centre de notifications persistant : jusqu'ici l'écran "Notifications" de l'app (NotificationBell)
-- ne vivait que dans le localStorage du navigateur, alimenté uniquement par la détection en direct
-- d'offres en vedette pendant la navigation -- rien ne s'affichait si l'utilisateur n'était pas en
-- train de parcourir la marketplace au bon moment. Une notification en base, réservée aux clients
-- connectés qui ont mis le commerce en favori, s'affiche désormais même après coup.
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  body text not null,
  commerce_slug text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_id_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;

-- Aucune policy insert : les lignes ne sont créées que par les Edge Functions d'alertes (clé
-- service_role, qui contourne la RLS), jamais directement par un client.
create policy "Un client lit ses notifications"
on public.notifications for select
to authenticated
using (user_id = auth.uid());

create policy "Un client marque ses notifications comme lues"
on public.notifications for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
