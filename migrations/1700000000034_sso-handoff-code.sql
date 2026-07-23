-- Up Migration

-- Backs the unified login/landing page (apps/web-landing): 3 separate
-- Next.js portals on 3 separate origins can't share an httpOnly session
-- cookie, so a real session handoff needs a redirect carrying *something*
-- from the landing app to the right portal. This table is that something —
-- an OAuth-authorization-code-style opaque reference, never the JWT/refresh
-- token itself. Same shape as password_reset_token/refresh_token (raw value
-- handed to the caller once, sha256 hash stored/looked-up, no RLS —
-- server-side only, never exposed via any GET): single-use (used_at),
-- short-lived (60s TTL set by AuthService, not enforced here), and scoped to
-- one specific actor_type+actor_id so it can only ever hand off into the one
-- portal it was issued for.
CREATE TABLE sso_handoff_code (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type   TEXT NOT NULL CHECK (actor_type IN ('CUSTOMER', 'SUPPLIER', 'ADMIN')),
  actor_id     UUID NOT NULL,
  code_hash    TEXT NOT NULL,
  expires_at   TIMESTAMPTZ NOT NULL,
  used_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_sso_handoff_code_hash ON sso_handoff_code(code_hash);
CREATE INDEX idx_sso_handoff_code_actor ON sso_handoff_code(actor_type, actor_id);

GRANT SELECT, INSERT, UPDATE ON sso_handoff_code TO app_role;

-- Down Migration

REVOKE SELECT, INSERT, UPDATE ON sso_handoff_code FROM app_role;
DROP TABLE IF EXISTS sso_handoff_code;
