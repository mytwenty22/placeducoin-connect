-- New account type: associations get their own Espace Pro flow, distinct from commerçants
-- ('pro'). Kept in its own migration file, separate from anything that uses the new label,
-- since a freshly added enum value can't safely be referenced by other DDL run in the same
-- transaction.

alter type public.app_role add value if not exists 'association';
