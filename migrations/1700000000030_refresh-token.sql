-- Up Migration

-- Access tokens shrink from a flat 12h to 1h (see auth.service.ts) — this
-- table is what makes that invisible to the user. Same shape as
-- password_reset_token (opaque raw token handed to the caller, sha256 hash
-- stored/looked-up, no RLS — server-side only, never exposed via any GET),
-- plus revoked_at/replaced_by_id to support rotation: each successful
-- refresh revokes the presented row and links it to its successor, so a
-- short grace window (see AuthService.refresh) can tell a legitimate
-- concurrent retry (e.g. two Next.js prefetches racing on the same
-- soon-to-expire cookie) apart from a genuinely stale/reused token.
CREATE TABLE refresh_token (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type     TEXT NOT NULL CHECK (actor_type IN ('CUSTOMER', 'SUPPLIER', 'ADMIN')),
  actor_id       UUID NOT NULL,
  token_hash     TEXT NOT NULL,
  expires_at     TIMESTAMPTZ NOT NULL,
  revoked_at     TIMESTAMPTZ,
  replaced_by_id UUID REFERENCES refresh_token(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_refresh_token_hash ON refresh_token(token_hash);
CREATE INDEX idx_refresh_token_actor ON refresh_token(actor_type, actor_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON refresh_token TO app_role;

-- Down Migration

REVOKE SELECT, INSERT, UPDATE, DELETE ON refresh_token FROM app_role;
DROP TABLE IF EXISTS refresh_token;
