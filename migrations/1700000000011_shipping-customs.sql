-- Up Migration

CREATE TABLE shipping_document (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     UUID NOT NULL REFERENCES "order"(id),
  doc_type     TEXT NOT NULL,   -- invoice / bill_of_lading / certificate ...
  file_url     TEXT NOT NULL,
  uploaded_by  UUID,
  uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE customs_fee (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          UUID NOT NULL REFERENCES "order"(id),
  label             TEXT NOT NULL,
  amount_sar        NUMERIC(14,2) NOT NULL,
  created_by        UUID NOT NULL REFERENCES admin_user(id),
  approved_by       UUID REFERENCES admin_user(id),   -- four-eyes required before status -> PUBLISHED
  status            customs_fee_status NOT NULL DEFAULT 'DRAFT',
  linked_payment_id UUID REFERENCES payment(id),
  CONSTRAINT customs_fee_publish_requires_approval
    CHECK (status = 'DRAFT' OR approved_by IS NOT NULL),
  CONSTRAINT customs_fee_four_eyes CHECK (approved_by IS NULL OR approved_by <> created_by)
);

-- Down Migration

DROP TABLE IF EXISTS customs_fee;
DROP TABLE IF EXISTS shipping_document;
