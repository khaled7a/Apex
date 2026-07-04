-- Up Migration

-- pg-boss self-migrates its own `pgboss` schema the first time it connects —
-- normally as app_role (via APP_DATABASE_URL), so it ends up owning that
-- schema with no extra grants needed, exactly like every hand-run local/dev
-- environment so far. On a host where APP_DATABASE_URL pointed at the wrong
-- (owner-privileged) role during an earlier deploy attempt — see
-- 1700000000032_bootstrap-app-role-password.js's own motivation — pg-boss's
-- self-migration runs as that role instead, so the schema ends up owned by
-- someone other than app_role. Once APP_DATABASE_URL is corrected, app_role
-- can no longer even see the schema ("permission denied for schema pgboss"),
-- reproduced and confirmed locally by temporarily reassigning ownership away
-- from app_role. Explicit grants here fix that regardless of who actually
-- ended up owning the schema, and are a no-op on environments where app_role
-- already owns it (nothing here narrows anything app_role already had).
--
-- Guarded with IF NOT EXISTS since a brand-new database won't have a
-- `pgboss` schema at all yet until pg-boss's own self-migration runs for the
-- first time (which happens after this migration, at app startup) — in that
-- case this just pre-creates it correctly owned, and pg-boss's own
-- "CREATE SCHEMA IF NOT EXISTS" finds it already there.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'pgboss') THEN
    CREATE SCHEMA pgboss AUTHORIZATION app_role;
  END IF;
END $$;

GRANT USAGE, CREATE ON SCHEMA pgboss TO app_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA pgboss TO app_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA pgboss TO app_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA pgboss GRANT ALL PRIVILEGES ON TABLES TO app_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA pgboss GRANT ALL PRIVILEGES ON SEQUENCES TO app_role;

-- Down Migration

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA pgboss FROM app_role;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA pgboss FROM app_role;
REVOKE USAGE, CREATE ON SCHEMA pgboss FROM app_role;
