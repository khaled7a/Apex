-- Up Migration

CREATE TABLE customer (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  company_name    TEXT,
  phone           TEXT NOT NULL,           -- internal verification only, never shown to any supplier
  email           TEXT NOT NULL UNIQUE,
  cr_number       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE admin_user (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  email           TEXT NOT NULL UNIQUE,
  role            admin_role NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  mfa_enabled     BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT mfa_required_for_sensitive_roles
    CHECK (role NOT IN ('OWNER', 'ACCOUNTANT') OR mfa_enabled)
);

-- Down Migration

DROP TABLE IF EXISTS admin_user;
DROP TABLE IF EXISTS customer;
