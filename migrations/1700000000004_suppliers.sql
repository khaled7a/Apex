-- Up Migration

CREATE TABLE supplier_category (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name  TEXT NOT NULL UNIQUE
);

CREATE TABLE registered_supplier (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name       TEXT NOT NULL,          -- never exposed to customer before IDENTITY_REVEALED
  is_active        BOOLEAN NOT NULL DEFAULT true,
  bank_account_ref TEXT,                   -- store encrypted at the application layer
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE supplier_category_map (
  registered_supplier_id UUID NOT NULL REFERENCES registered_supplier(id),
  supplier_category_id   UUID NOT NULL REFERENCES supplier_category(id),
  PRIMARY KEY (registered_supplier_id, supplier_category_id)
);
-- NOTE: category is descriptive only. Publishing (REG_PUBLISHED) does NOT
-- filter by this table — decision recorded in state-machine.md §2.

CREATE TABLE external_supplier (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id            UUID NOT NULL, -- FK added in the `order` migration below
  legal_name          TEXT NOT NULL,
  license_number      TEXT,
  years_active        INTEGER,
  verification_source TEXT,          -- 'aiqicha' / 'qcc' / 'manual'
  vetting_status      vetting_status NOT NULL DEFAULT 'PENDING',
  vetted_by           UUID REFERENCES admin_user(id),
  vetted_at           TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Down Migration

DROP TABLE IF EXISTS external_supplier;
DROP TABLE IF EXISTS supplier_category_map;
DROP TABLE IF EXISTS registered_supplier;
DROP TABLE IF EXISTS supplier_category;
