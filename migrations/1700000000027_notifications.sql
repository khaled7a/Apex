-- Up Migration

-- Suppliers currently have zero contact fields at all (registered_supplier
-- only has legal_name/is_active/bank_account_ref) — notifying a supplier by
-- email or WhatsApp is impossible without these. Nullable, no backfill: a
-- supplier's contact info is filled in by an admin whenever it becomes
-- known; NotificationsService treats a missing value as SKIPPED_NO_CONTACT
-- rather than an error.
ALTER TABLE registered_supplier ADD COLUMN contact_email TEXT;
ALTER TABLE registered_supplier ADD COLUMN whatsapp_phone TEXT;

CREATE TABLE notification_log (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       UUID NOT NULL REFERENCES "order"(id),
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('CUSTOMER', 'SUPPLIER')),
  recipient_id   UUID NOT NULL,
  channel        TEXT NOT NULL CHECK (channel IN ('EMAIL', 'WHATSAPP')),
  message        TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'PENDING'
                   CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'SKIPPED_NO_CONTACT', 'SKIPPED_NO_CONFIG')),
  error          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at        TIMESTAMPTZ
);

-- Same FOR SELECT (restrictive) / FOR INSERT+UPDATE (permissive) split as
-- dispute/escalation/production_update in 1700000000018_rls-policies.sql:
-- this table is only ever written by TransitionEngineService itself
-- (system-level bookkeeping alongside state_transition_log/audit_log), never
-- from a free-form user-supplied INSERT, so RLS only needs to protect reads.
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log FORCE ROW LEVEL SECURITY;
CREATE POLICY notification_log_read ON notification_log FOR SELECT
  USING (order_visible_to_actor(notification_log.order_id));
CREATE POLICY notification_log_write ON notification_log FOR INSERT WITH CHECK (true);
CREATE POLICY notification_log_modify ON notification_log FOR UPDATE USING (true);

-- app_role needs explicit per-table grants (see 1700000000019) — there is no
-- blanket ALL TABLES grant in this schema.
GRANT SELECT, INSERT, UPDATE ON notification_log TO app_role;

-- Down Migration

REVOKE SELECT, INSERT, UPDATE ON notification_log FROM app_role;

DROP POLICY IF EXISTS notification_log_modify ON notification_log;
DROP POLICY IF EXISTS notification_log_write ON notification_log;
DROP POLICY IF EXISTS notification_log_read ON notification_log;
DROP TABLE IF EXISTS notification_log;

ALTER TABLE registered_supplier DROP COLUMN IF EXISTS whatsapp_phone;
ALTER TABLE registered_supplier DROP COLUMN IF EXISTS contact_email;
