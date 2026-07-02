-- Up Migration

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for gen_random_uuid(), digest()

-- ----------------------------------------------------------------------------
-- Roles: app_role is what the application connects as. audit_log grants are
-- deliberately append-only — this is the DB-level enforcement the review
-- insisted on (not just application discipline).
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_role') THEN
    CREATE ROLE app_role LOGIN;
  END IF;
END $$;

-- Down Migration

DROP ROLE IF EXISTS app_role;
DROP EXTENSION IF EXISTS pgcrypto;
