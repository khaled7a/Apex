-- Up Migration

-- pg-boss manages its own schema (a `pgboss` schema with its own job/queue
-- tables) the first time it starts, which requires CREATE on the database.
-- Discovered by actually booting the API: app_role had no grants beyond the
-- specific tables in the grant-app-role-privileges migration, so pg-boss's
-- self-migration failed with "permission denied for database apex_dev".
-- Uses dynamic SQL because GRANT ... ON DATABASE needs a literal identifier,
-- not an expression, and the database name varies across environments.
DO $$
BEGIN
  EXECUTE format('GRANT CREATE ON DATABASE %I TO app_role', current_database());
END $$;

-- Down Migration

DO $$
BEGIN
  EXECUTE format('REVOKE CREATE ON DATABASE %I FROM app_role', current_database());
END $$;
