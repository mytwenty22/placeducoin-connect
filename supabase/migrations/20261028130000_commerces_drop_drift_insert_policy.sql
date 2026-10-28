-- La base de production portait sur public.commerces une policy "Insert commerces" absente des
-- migrations du dépôt. Son with check ne vérifiait que le rôle de l'appelant (pro, association ou
-- service_role), jamais owner_id : un compte pro pouvait créer une fiche au nom d'un autre
-- propriétaire, et une association sans RNA ni SIRET pouvait créer la sienne.
--
-- La création reste couverte par "Un pro ou une association crée sa fiche"
-- (20261016100000_entity_identifiers.sql) : owner_id = auth.uid(), et RNA ou SIRET exigé pour une
-- association. Le service_role contourne la RLS et n'a pas besoin de policy.

drop policy if exists "Insert commerces" on public.commerces;
