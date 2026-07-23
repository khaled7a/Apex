-- Up Migration

-- Real credential-based login was never built — apps/api/src/auth/auth.controller.ts
-- only has dev-only token issuance (mints a JWT for any existing id with no
-- password check, disabled outside development). A real frontend needs
-- actual login, which needs somewhere to store a password hash.
ALTER TABLE customer ADD COLUMN password_hash TEXT;
ALTER TABLE admin_user ADD COLUMN password_hash TEXT;
ALTER TABLE registered_supplier ADD COLUMN password_hash TEXT;

-- contact_email (added in 1700000000027 for notifications) becomes the
-- supplier's login identity too. Postgres allows multiple NULLs under a
-- plain UNIQUE constraint, so this does not break existing suppliers that
-- have no contact_email yet.
ALTER TABLE registered_supplier ADD CONSTRAINT registered_supplier_contact_email_key UNIQUE (contact_email);

-- Generic file upload record backing POST /uploads + GET /uploads/:id.
-- Files are stored on local disk (no cloud storage credentials available in
-- this environment yet — see the SMTP/WhatsApp precedent), but access is
-- still controlled: GET /uploads/:id checks order_visible_to_actor(order_id)
-- (the same function RLS policies already use) before streaming the file,
-- rather than serving them from a public static directory.
CREATE TABLE uploaded_file (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID NOT NULL REFERENCES "order"(id),
  uploaded_by_type  TEXT NOT NULL CHECK (uploaded_by_type IN ('CUSTOMER', 'SUPPLIER', 'ADMIN')),
  uploaded_by_id    UUID,
  stored_filename   TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type         TEXT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Same FOR SELECT (restrictive, via the shared order-visibility function) /
-- FOR INSERT (permissive) split used for notification_log/dispute/etc. —
-- GET /uploads/:id also re-checks visibility at the application layer before
-- streaming bytes, but RLS is the actual boundary if that check is ever
-- bypassed or a future endpoint queries this table directly.
ALTER TABLE uploaded_file ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploaded_file FORCE ROW LEVEL SECURITY;
CREATE POLICY uploaded_file_read ON uploaded_file FOR SELECT
  USING (order_visible_to_actor(uploaded_file.order_id));
CREATE POLICY uploaded_file_write ON uploaded_file FOR INSERT WITH CHECK (true);

GRANT SELECT, INSERT ON uploaded_file TO app_role;

-- Down Migration

REVOKE SELECT, INSERT ON uploaded_file FROM app_role;

DROP POLICY IF EXISTS uploaded_file_write ON uploaded_file;
DROP POLICY IF EXISTS uploaded_file_read ON uploaded_file;
DROP TABLE IF EXISTS uploaded_file;

ALTER TABLE registered_supplier DROP CONSTRAINT IF EXISTS registered_supplier_contact_email_key;

ALTER TABLE registered_supplier DROP COLUMN IF EXISTS password_hash;
ALTER TABLE admin_user DROP COLUMN IF EXISTS password_hash;
ALTER TABLE customer DROP COLUMN IF EXISTS password_hash;
