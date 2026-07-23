-- Up Migration

CREATE TABLE service_type (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code                            TEXT NOT NULL UNIQUE,
  label_ar                        TEXT NOT NULL,
  commission_rate_percent         NUMERIC(5,2) NOT NULL,
  includes_sourcing               BOOLEAN NOT NULL,
  includes_identity_management    BOOLEAN NOT NULL,
  includes_production_oversight   BOOLEAN NOT NULL,
  includes_customs_clearance      BOOLEAN NOT NULL DEFAULT true,
  description_included_ar         TEXT,
  description_excluded_ar         TEXT,
  is_active                       BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO service_type (code, label_ar, commission_rate_percent, includes_sourcing, includes_identity_management, includes_production_oversight)
VALUES
  ('DOOR_TO_DOOR', 'باب لباب', 0, true, true, true),
  ('SHIPPING_CLEARANCE_ONLY', 'شحن وتخليص فقط', 0, false, false, false),
  ('EXTERNAL_SUPPLIER_SERVICE', 'مورد خارجي', 0, true, true, false);
-- commission_rate_percent left at 0 as a placeholder; set from platform settings.

-- Down Migration

DROP TABLE IF EXISTS service_type;
