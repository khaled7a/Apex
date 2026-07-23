-- Up Migration

CREATE TABLE production_update (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES "order"(id),
  kind        TEXT NOT NULL,   -- 'text' / 'image' / 'invoice' / 'question'
  content     TEXT,
  file_url    TEXT,
  posted_by   TEXT NOT NULL,  -- 'SUPPLIER' / 'CUSTOMER'
  posted_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE escalation (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id       UUID NOT NULL REFERENCES "order"(id),
  actor          escalation_actor NOT NULL,
  checkpoint     TEXT,           -- 'design_sample' / 'pre_shipping' / null for supplier deliverables
  reminder_sent_at TIMESTAMPTZ,
  escalated_at   TIMESTAMPTZ,
  resolved_at    TIMESTAMPTZ,
  outcome        TEXT            -- 'RESPONDED' / 'CANCELLED_PENDING_RENEWAL' / 'DISPUTE_DELAY_OPENED'
);

CREATE TABLE agreement_renewal (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              UUID NOT NULL REFERENCES "order"(id),
  renewal_of_agreement_id UUID REFERENCES agreement_renewal(id), -- chain across multiple renewals
  requested_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  supplier_decision     renewal_decision NOT NULL DEFAULT 'PENDING',
  supplier_decided_at   TIMESTAMPTZ,
  admin_decision        renewal_decision NOT NULL DEFAULT 'PENDING',
  admin_decided_by      UUID REFERENCES admin_user(id),
  admin_decided_at      TIMESTAMPTZ
);

-- Down Migration

DROP TABLE IF EXISTS agreement_renewal;
DROP TABLE IF EXISTS escalation;
DROP TABLE IF EXISTS production_update;
