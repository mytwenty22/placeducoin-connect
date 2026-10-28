-- "Un pro crée sa fiche commerce" devait disparaître avec 20260909205900_association_account_rules.sql,
-- mais existait encore en production. Sans risque (owner_id = auth.uid() et rôle pro), elle ne
-- permettait rien de plus que "Un pro ou une association crée sa fiche", qui reste la seule policy
-- de création : on la retire pour aligner la base sur le dépôt.

drop policy if exists "Un pro crée sa fiche commerce" on public.commerces;
