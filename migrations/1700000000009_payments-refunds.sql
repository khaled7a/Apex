-- Up Migration

CREATE TABLE payment (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installment_id              UUID NOT NULL REFERENCES payment_installment(id),
  amount_sar                  NUMERIC(14,2) NOT NULL,
  paid_at                     TIMESTAMPTZ,               -- customer-claimed transfer time
  refund_policy               refund_policy NOT NULL,     -- immutable historical fact, copied from installment at creation
  current_refundability_status refundability_status NOT NULL DEFAULT 'REFUNDABLE',
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enforce immutability of refund_policy at the DB level: only
-- current_refundability_status may change after insert.
CREATE OR REPLACE FUNCTION forbid_refund_policy_change() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.refund_policy IS DISTINCT FROM OLD.refund_policy THEN
    RAISE EXCEPTION 'payment.refund_policy is immutable once set';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_forbid_refund_policy_change
  BEFORE UPDATE ON payment
  FOR EACH ROW EXECUTE FUNCTION forbid_refund_policy_change();

CREATE TABLE receipt (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id              UUID NOT NULL REFERENCES payment(id),
  file_url                TEXT NOT NULL,
  bank_reference_no       TEXT NOT NULL,       -- structured field, not just an image
  bank_name               TEXT,
  amount_claimed          NUMERIC(14,2) NOT NULL,
  transfer_date_claimed   DATE NOT NULL,
  receipt_fingerprint     TEXT NOT NULL,        -- sha256(bank_reference_no || amount || date)
  perceptual_hash         TEXT,                 -- catches the same image re-uploaded at different compression
  ocr_extracted_fields    JSONB,
  verification_status     TEXT NOT NULL DEFAULT 'PENDING',
  verified_by             UUID REFERENCES admin_user(id),
  verified_at             TIMESTAMPTZ,
  rejection_reason        TEXT,
  CONSTRAINT uq_receipt_fingerprint UNIQUE (receipt_fingerprint) -- blocks reuse across ANY order/payment
);

CREATE TABLE refund_transaction (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id       UUID NOT NULL REFERENCES payment(id),
  dispute_id       UUID,  -- FK added in the disputes migration
  refunded_amount_sar NUMERIC(14,2) NOT NULL,
  refund_ratio     NUMERIC(5,4),
  decided_by_owner UUID NOT NULL REFERENCES admin_user(id),
  decided_by_accountant UUID NOT NULL REFERENCES admin_user(id),
  decided_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason           TEXT NOT NULL,
  CONSTRAINT four_eyes_distinct_approvers CHECK (decided_by_owner <> decided_by_accountant)
);

-- Down Migration

DROP TABLE IF EXISTS refund_transaction;
DROP TABLE IF EXISTS receipt;
DROP TRIGGER IF EXISTS trg_forbid_refund_policy_change ON payment;
DROP FUNCTION IF EXISTS forbid_refund_policy_change();
DROP TABLE IF EXISTS payment;
