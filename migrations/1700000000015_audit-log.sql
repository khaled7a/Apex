-- Up Migration

CREATE TABLE audit_log (
  id            BIGSERIAL PRIMARY KEY,
  entity_type   TEXT NOT NULL,
  entity_id     UUID NOT NULL,
  action        TEXT NOT NULL,
  actor_id      UUID,
  actor_role    TEXT NOT NULL,
  state_before  JSONB,
  state_after   JSONB,
  ip_address    INET,
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now(),  -- server-side only, never client-supplied
  prev_hash     TEXT,
  record_hash   TEXT NOT NULL
);

-- Hash-chaining trigger: computes record_hash from the row payload + previous
-- row's hash, so any later tampering breaks the chain and is detectable.
CREATE OR REPLACE FUNCTION audit_log_chain_hash() RETURNS TRIGGER AS $$
DECLARE
  last_hash TEXT;
BEGIN
  SELECT record_hash INTO last_hash FROM audit_log ORDER BY id DESC LIMIT 1;
  NEW.prev_hash := last_hash;
  NEW.occurred_at := now();
  NEW.record_hash := encode(
    digest(
      COALESCE(last_hash, '') || NEW.entity_type || NEW.entity_id::text || NEW.action ||
      COALESCE(NEW.actor_id::text, '') || COALESCE(NEW.state_before::text, '') ||
      COALESCE(NEW.state_after::text, '') || NEW.occurred_at::text,
      'sha256'
    ),
    'hex'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_log_chain_hash
  BEFORE INSERT ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_chain_hash();

-- True append-only enforcement: revoke UPDATE/DELETE from the application
-- role entirely, including for OWNER-level actions in the app itself.
REVOKE UPDATE, DELETE ON audit_log FROM app_role;
GRANT INSERT, SELECT ON audit_log TO app_role;
GRANT USAGE, SELECT ON SEQUENCE audit_log_id_seq TO app_role;

CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);

-- Down Migration

DROP INDEX IF EXISTS idx_audit_entity;
DROP TRIGGER IF EXISTS trg_audit_log_chain_hash ON audit_log;
DROP FUNCTION IF EXISTS audit_log_chain_hash();
DROP TABLE IF EXISTS audit_log;
