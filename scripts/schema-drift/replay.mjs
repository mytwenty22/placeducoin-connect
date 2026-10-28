// Rejoue supabase/migrations dans PGlite (Postgres embarqué, sans Docker) avec des stubs des
// schémas propres à Supabase (auth, storage, vault, net, cron, realtime), exporte l'inventaire
// d'inventory.sql et exécute les vérifications de comportement de checks.sql.
import fs from "node:fs";
import path from "node:path";

const STUBS = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create role supabase_admin nologin; create role authenticator nologin;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
create schema auth; create schema storage; create schema extensions; create schema vault;
create schema net; create schema cron; create schema supabase_migrations;
create table supabase_migrations.schema_migrations (version text primary key);
create table auth.users (
  id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb,
  raw_app_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now(),
  last_sign_in_at timestamptz, email_confirmed_at timestamptz, phone text
);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claim.role', true) $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create table storage.buckets (id text primary key, name text, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[], owner uuid, created_at timestamptz default now());
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text,
  owner uuid, metadata jsonb, created_at timestamptz default now());
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
create table vault.secrets (id uuid primary key default gen_random_uuid(), name text, secret text);
create view vault.decrypted_secrets as select id, name, secret as decrypted_secret from vault.secrets;
create function vault.create_secret(secret text, name text) returns uuid language sql as $$ insert into vault.secrets(name, secret) values (name, secret) returning id $$;
create function net.http_post(url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb,
  headers jsonb default '{}'::jsonb, timeout_milliseconds int default 1000) returns bigint language sql as $$ select 1::bigint $$;
create table cron.job (jobid bigserial primary key, jobname text, schedule text, command text);
create function cron.schedule(job_name text, schedule text, command text) returns bigint language sql as
  $$ insert into cron.job(jobname, schedule, command) values (job_name, schedule, command) returning jobid $$;
create function cron.unschedule(job_id bigint) returns boolean language sql as $$ delete from cron.job where jobid = job_id returning true $$;
create publication supabase_realtime;
`;

/**
 * @returns {Promise<{ failures: { file: string, error: string }[], inventory: object,
 *   checks: { name: string, ok: boolean, detail: string | null }[] }>}
 */
export async function replayMigrations({ PGlite, migrationsDir, inventorySql, checksSql }) {
  const db = new PGlite();
  await db.exec(STUBS);

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const failures = [];
  for (const file of files) {
    // Les extensions (pg_net, pg_cron) sont remplacées par les stubs ci-dessus.
    const sql = fs
      .readFileSync(path.join(migrationsDir, file), "utf8")
      .replace(/create extension[^;]*;/gi, "");
    try {
      await db.exec(sql);
      await db.query("insert into supabase_migrations.schema_migrations(version) values ($1)", [
        file.split("_")[0],
      ]);
    } catch (error) {
      failures.push({ file, error: error.message });
    }
  }

  const inventory = (await db.query(inventorySql)).rows[0].inventory;
  const checks = checksSql ? (await db.exec(checksSql)).at(-1).rows : [];
  await db.close();
  return { failures, inventory, checks };
}
