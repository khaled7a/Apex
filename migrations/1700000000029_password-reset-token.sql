-- Up Migration

-- No forgot-password flow existed at all — only change-password (requires
-- the current password) per actor type. Stores a hash of the raw token
-- (sha256, not bcrypt — this needs to be looked up by exact value, not
-- compared one candidate at a time) so a leaked DB dump can't be replayed
-- as a working reset link. No RLS: same treatment as admin_user/customer/
-- registered_supplier themselves — this table is only ever touched by
-- AuthService server-side code, never exposed via any GET endpoint.
CREATE TABLE password_reset_token (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type   TEXT NOT NULL CHECK (actor_type IN ('CUSTOMER', 'SUPPLIER', 'ADMIN')),
  actor_id     UUID NOT NULL,
  token_hash   TEXT NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  used_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_password_reset_token_hash ON password_reset_token(token_hash);
CREATE INDEX idx_password_reset_token_actor ON password_reset_token(actor_type, actor_id);

GRANT SELECT, INSERT, UPDATE ON password_reset_token TO app_role;

-- Down Migration

REVOKE SELECT, INSERT, UPDATE ON password_reset_token FROM app_role;
DROP TABLE IF EXISTS password_reset_token;
