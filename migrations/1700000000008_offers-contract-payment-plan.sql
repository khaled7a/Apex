-- Up Migration

CREATE TABLE offer (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                UUID NOT NULL REFERENCES "order"(id),
  registered_supplier_id  UUID NOT NULL REFERENCES registered_supplier(id),
  fob_value_usd           NUMERIC(14,2) NOT NULL,
  lead_time_days          INTEGER,
  terms                   TEXT,
  submitted_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  admin_review_status     TEXT NOT NULL DEFAULT 'PENDING'
);
-- Closed-bidding isolation is enforced by Row-Level Security — see the
-- rls-policies migration, which activates this for real (this used to be a
-- comment-only placeholder in the original docs/schema.sql draft).

CREATE TABLE contract (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID NOT NULL UNIQUE REFERENCES "order"(id),
  type            contract_type NOT NULL DEFAULT 'STANDARD',
  signed_at       TIMESTAMPTZ,
  signature_ref   TEXT,
  terms_snapshot  JSONB NOT NULL
);

CREATE TABLE payment_plan (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id         UUID NOT NULL UNIQUE REFERENCES contract(id),
  created_by          UUID NOT NULL REFERENCES admin_user(id),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  total_installments  INTEGER NOT NULL
);

CREATE TABLE payment_installment (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_plan_id           UUID NOT NULL REFERENCES payment_plan(id),
  sequence_no               INTEGER NOT NULL,
  label                     TEXT NOT NULL,             -- 'DEPOSIT' / 'FIRST_PAYMENT' / 'PRODUCTION_MILESTONE' / 'CUSTOMS_FEE' ...
  expected_amount_sar       NUMERIC(14,2) NOT NULL,
  is_trust_fund             BOOLEAN NOT NULL,          -- destined for the supplier vs. company revenue
  refund_policy             refund_policy NOT NULL,
  unique_payment_reference  TEXT NOT NULL UNIQUE,       -- generated before transfer, written on the bank memo
  due_stage                 order_state,
  UNIQUE (payment_plan_id, sequence_no)
);

-- Down Migration

DROP TABLE IF EXISTS payment_installment;
DROP TABLE IF EXISTS payment_plan;
DROP TABLE IF EXISTS contract;
DROP TABLE IF EXISTS offer;
