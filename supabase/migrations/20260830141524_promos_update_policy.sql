-- Aucune policy UPDATE n'existait sur promos (seulement select/insert/delete),
-- ce qui bloquait silencieusement toute modification (ex: simuler une expiration)
-- : PostgREST renvoie 200 avec 0 ligne affectée plutôt qu'une erreur explicite.
create policy "Un pro modifie ses propres promos"
on public.promos for update
to authenticated
using (
  exists (select 1 from public.commerces c where c.id = commerce_id and c.owner_id = auth.uid())
);
