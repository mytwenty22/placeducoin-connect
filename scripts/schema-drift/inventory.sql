-- Inventaire du schéma (tables, colonnes, policies, contraintes, triggers, fonctions, index,
-- stockage, droits, migrations, realtime, cron), exécuté à l'identique sur la production et sur la
-- base rejouée depuis supabase/migrations. Voir run.mjs.
select json_build_object(
  'tables', (select json_agg(json_build_object('name', c.relname, 'rls', c.relrowsecurity) order by c.relname)
             from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relkind = 'r'),
  'views', (select json_agg(c.relname order by c.relname)
             from pg_class c join pg_namespace n on n.oid = c.relnamespace
             where n.nspname = 'public' and c.relkind in ('v', 'm')),
  'columns', (select json_agg(json_build_object('t', table_name, 'c', column_name, 'type', data_type,
                'nullable', is_nullable, 'default', column_default) order by table_name, ordinal_position)
              from information_schema.columns where table_schema = 'public'
                and table_name in (select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
                                   where n.nspname = 'public' and c.relkind = 'r')),
  'policies', (select json_agg(json_build_object('t', tablename, 'name', policyname, 'cmd', cmd,
                 'roles', roles::text, 'permissive', permissive, 'qual', qual, 'check', with_check)
                 order by tablename, policyname)
               from pg_policies where schemaname = 'public'),
  'constraints', (select json_agg(json_build_object('t', conrelid::regclass::text, 'name', conname,
                    'type', contype, 'def', pg_get_constraintdef(oid)) order by conrelid::regclass::text, conname)
                  from pg_constraint where connamespace = 'public'::regnamespace and conrelid <> 0),
  'triggers', (select json_agg(json_build_object('t', tgrelid::regclass::text, 'name', tgname,
                 'def', pg_get_triggerdef(t.oid)) order by tgrelid::regclass::text, tgname)
               from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
               where not tgisinternal and n.nspname in ('public', 'auth', 'storage')),
  'functions', (select json_agg(json_build_object('name', p.proname, 'args', pg_get_function_identity_arguments(p.oid),
                  'secdef', p.prosecdef, 'md5', md5(regexp_replace(p.prosrc, '[[:space:]]+', ' ', 'g')), 'config', p.proconfig::text) order by p.proname)
                from pg_proc p where p.pronamespace = 'public'::regnamespace),
  'indexes', (select json_agg(json_build_object('t', tablename, 'name', indexname, 'def', indexdef) order by tablename, indexname)
              from pg_indexes where schemaname = 'public'),
  'storage_policies', (select json_agg(json_build_object('t', tablename, 'name', policyname, 'cmd', cmd,
                         'roles', roles::text, 'qual', qual, 'check', with_check) order by policyname)
                       from pg_policies where schemaname = 'storage'),
  'buckets', (select json_agg(json_build_object('id', id, 'public', public, 'size', file_size_limit, 'mime', allowed_mime_types) order by id) from storage.buckets),
  'enums', (select json_agg(json_build_object('type', t.typname, 'labels', (select json_agg(enumlabel order by enumsortorder) from pg_enum e where e.enumtypid = t.oid)) order by t.typname)
            from pg_type t where t.typnamespace = 'public'::regnamespace and t.typtype = 'e'),
  'grants_anon_auth', (select json_agg(json_build_object('t', table_name, 'role', grantee, 'priv', privilege_type) order by table_name, grantee, privilege_type)
                       from information_schema.role_table_grants where table_schema = 'public' and grantee in ('anon', 'authenticated')),
  'migrations', (select json_agg(version order by version) from supabase_migrations.schema_migrations),
  'publication', (select json_agg(tablename order by tablename) from pg_publication_tables where pubname = 'supabase_realtime'),
  'cron', (select json_agg(json_build_object('name', jobname, 'schedule', schedule, 'cmd', left(command, 300))) from cron.job)
) as inventory;
