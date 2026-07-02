-- ============================================================================
-- Apex Sourcing — B2B Import Order Management Platform
-- PostgreSQL schema derived from docs/data-model.md and docs/state-machine.md
-- ============================================================================
-- This is a reference implementation of the reviewed & agreed design. It is
-- illustrative (not exhaustively indexed/tuned) but every constraint here
-- encodes a rule the review flagged as critical — do not relax them without
-- re-reading the corresponding section of docs/data-model.md.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for gen_random_uuid(), digest()

-- ----------------------------------------------------------------------------
-- Roles: app_role is what the application connects as. audit_log grants are
-- deliberately append-only — this is the DB-level enforcement the review
-- insisted on (not just application discipline).
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_role') THEN
    CREATE ROLE app_role LOGIN;
  END IF;
END $$;

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE admin_role AS ENUM ('OWNER', 'OPERATOR', 'ACCOUNTANT');

CREATE TYPE supplier_type AS ENUM ('REGISTERED', 'EXTERNAL', 'NONE');

CREATE TYPE order_state AS ENUM (
  'DRAFT', 'SUBMITTED',
  'REVIEW_PENDING', 'REVIEW_NEEDS_EDIT', 'REVIEW_APPROVED', 'REVIEW_REJECTED',
  'SUPPLIER_CHOICE',
  'EXT_VETTING_DOCS', 'EXT_VETTING_APPROVED', 'EXT_VETTING_REJECTED',
  'REG_PUBLISHED', 'REG_BIDS_COLLECTING', 'REG_BIDS_EXPIRED_NO_OFFERS',
  'REG_ADMIN_REVIEW_BIDS', 'REG_SHOWN_TO_CUSTOMER', 'REG_CUSTOMER_SELECTS',
  'REG_NO_OFFER_SELECTED',
  'CONTRACT_PAYMENT_PLAN_CREATED', 'CONTRACT_SIGNED', 'CONTRACT_BANK_TRANSFER_DONE',
  'CONTRACT_RECEIPT_UPLOADED', 'CONTRACT_ADMIN_VERIFYING', 'CONTRACT_RECEIPT_REJECTED',
  'IDENTITY_REVEALED',
  'PAYMENT_PENDING_SUPPLIER_ACK', 'PAYMENT_PENDING_ADMIN_VERIFICATION',
  'SUPPLIER_PAYMENT_CONFIRMED',
  'PROD_DESIGN_SUBMITTED', 'PROD_CHECKPOINT_1', 'PROD_CHECKPOINT_1_REJECTED',
  'PROD_FULL_PRODUCTION', 'PROD_QC_SUBMITTED', 'PROD_CHECKPOINT_2', 'PROD_CHECKPOINT_2_REJECTED',
  'ESCALATION_REMINDER', 'ESCALATION_ESCALATED',
  'AGREEMENT_CANCELLED_PENDING_RENEWAL',
  'RENEWAL_PENDING_SUPPLIER', 'RENEWAL_PENDING_ADMIN', 'RENEWAL_SUPPLIER_DECLINED',
  'LOGISTICS_ONLY_SETUP',
  'LOADING_SHIPPING', 'SHIPPING_DOCS', 'PAYMENT_INSTALLMENTS_PENDING',
  'IN_TRANSIT', 'ARRIVED_PORT',
  'CUSTOMS_FEE_ADDED', 'CUSTOMS_CUSTOMER_PAYS', 'CUSTOMS_FEE_PROOF_UPLOADED', 'CUSTOMS_FEE_VERIFIED',
  'FINAL_DELIVERY', 'CUSTOMER_SIGNED', 'SUPPLIER_RATED', 'COMPLETED',
  'DISPUTE_PAYMENT', 'DISPUTE_QUALITY', 'DISPUTE_DELAY', 'DISPUTE_SHIPPING',
  'DISPUTE_MANDATORY_REFUND', 'DISPUTE_RESOLVED',
  'CANCELLED'
);

CREATE TYPE hold_type AS ENUM ('NONE', 'ESCALATION', 'DISPUTE');

CREATE TYPE escalation_actor AS ENUM ('CUSTOMER_APPROVAL', 'SUPPLIER_DELIVERABLE');

CREATE TYPE dispute_type AS ENUM ('PAYMENT', 'QUALITY', 'DELAY', 'SHIPPING', 'MANDATORY_REFUND');

CREATE TYPE dispute_status AS ENUM ('OPEN', 'RESOLVED');

CREATE TYPE refund_policy AS ENUM ('NEVER_REFUNDABLE', 'REFUNDABLE_UNTIL_EVENT', 'REFUNDABLE_BY_DISPUTE_ONLY');

CREATE TYPE refundability_status AS ENUM ('REFUNDABLE', 'LOCKED');

CREATE TYPE contract_type AS ENUM ('STANDARD', 'LOGISTICS_ONLY');

CREATE TYPE customs_fee_status AS ENUM ('DRAFT', 'PUBLISHED', 'PAID', 'VERIFIED');

CREATE TYPE rating_phase AS ENUM ('PRE_CONTRACT', 'POST_CONTRACT');

CREATE TYPE vetting_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TYPE renewal_decision AS ENUM ('PENDING', 'APPROVED', 'DECLINED');

-- ============================================================================
-- USERS & RBAC
-- ============================================================================

CREATE TABLE customer (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  company_name    TEXT,
  phone           TEXT NOT NULL,           -- internal verification only, never shown to any supplier
  email           TEXT NOT NULL UNIQUE,
  cr_number       TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE admin_user (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  email           TEXT NOT NULL UNIQUE,
  role            admin_role NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  mfa_enabled     BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT mfa_required_for_sensitive_roles
    CHECK (role NOT IN ('OWNER', 'ACCOUNTANT') OR mfa_enabled)
);

-- ============================================================================
-- SUPPLIERS
-- ============================================================================

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
  order_id            UUID NOT NULL, -- FK added after `order` table below
  legal_name          TEXT NOT NULL,
  license_number      TEXT,
  years_active        INTEGER,
  verification_source TEXT,          -- 'aiqicha' / 'qcc' / 'manual'
  vetting_status      vetting_status NOT NULL DEFAULT 'PENDING',
  vetted_by           UUID REFERENCES admin_user(id),
  vetted_at           TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- SERVICE TYPE (configurable, not a hardcoded 3-way branch — see state-machine.md §0.4)
-- ============================================================================

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

-- ============================================================================
-- ORDER (central entity)
-- ============================================================================

CREATE TABLE "order" (
  id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id                     UUID NOT NULL REFERENCES customer(id),
  service_type_id                 UUID NOT NULL REFERENCES service_type(id),
  supplier_type                   supplier_type NOT NULL DEFAULT 'NONE',
  registered_supplier_id          UUID REFERENCES registered_supplier(id),
  external_supplier_id            UUID REFERENCES external_supplier(id),

  current_state                   order_state NOT NULL DEFAULT 'DRAFT',
  state_version                   INTEGER NOT NULL DEFAULT 0,       -- optimistic lock
  hold_type                       hold_type NOT NULL DEFAULT 'NONE',
  resume_target_state             TEXT,                             -- "<COMPOSITE>.<SUBSTATE>"
  active_dispute_id               UUID,                             -- FK added after dispute table

  financial_commitment_started_at TIMESTAMPTZ,                      -- written once, first SUPPLIER_PAYMENT_CONFIRMED
  fx_rate_used                    NUMERIC(12,6),
  fx_rate_source                  TEXT,
  fx_rate_entered_by              UUID REFERENCES admin_user(id),
  fx_rate_deviation_flag          BOOLEAN NOT NULL DEFAULT false,
  fob_value_usd                   NUMERIC(14,2),
  final_value_sar                 NUMERIC(14,2),
  low_competition_offer           BOOLEAN NOT NULL DEFAULT false,

  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT supplier_ref_matches_type CHECK (
    (supplier_type = 'REGISTERED' AND registered_supplier_id IS NOT NULL AND external_supplier_id IS NULL) OR
    (supplier_type = 'EXTERNAL'   AND external_supplier_id   IS NOT NULL AND registered_supplier_id IS NULL) OR
    (supplier_type = 'NONE'       AND registered_supplier_id IS NULL AND external_supplier_id IS NULL)
  ),
  CONSTRAINT fx_rate_requires_source CHECK (fx_rate_used IS NULL OR fx_rate_source IS NOT NULL)
);

ALTER TABLE external_supplier
  ADD CONSTRAINT external_supplier_order_fk FOREIGN KEY (order_id) REFERENCES "order"(id);

-- NOTE: "no two concurrent disputes on the same order" cannot be enforced
-- here — a UNIQUE index on "order"(id) is a no-op (the primary key already
-- guarantees it). The real constraint belongs on the `dispute` table itself
-- (see `one_open_dispute_per_order` below, added once that table exists).

CREATE INDEX idx_order_customer ON "order"(customer_id);
CREATE INDEX idx_order_state ON "order"(current_state);

-- ============================================================================
-- STATE TRANSITION LOG (full history — entered_at/exited_at per transition)
-- ============================================================================

CREATE TABLE state_transition_log (
  id            BIGSERIAL PRIMARY KEY,
  order_id      UUID NOT NULL REFERENCES "order"(id),
  from_state    order_state,
  to_state      order_state NOT NULL,
  event         TEXT NOT NULL,
  acted_by_role TEXT NOT NULL,             -- 'CUSTOMER' / 'SUPPLIER' / 'ADMIN' / 'SYSTEM'
  acted_by_id   UUID,
  entered_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  exited_at     TIMESTAMPTZ,               -- filled in when the NEXT transition happens
  payload       JSONB
);

CREATE INDEX idx_stl_order ON state_transition_log(order_id, entered_at);

-- ============================================================================
-- OFFERS / CONTRACT / PAYMENT PLAN
-- ============================================================================

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
-- Closed-bidding isolation: enforce via Row-Level Security so a supplier's
-- session can only ever SELECT rows where registered_supplier_id = current
-- session's supplier id. Example policy (adapt to your auth model):
--
-- ALTER TABLE offer ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY supplier_sees_own_offers ON offer
--   USING (registered_supplier_id = current_setting('app.current_supplier_id')::uuid);

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

-- ============================================================================
-- PAYMENTS & REFUNDS — the is_refundable fix (data-model.md §5)
-- ============================================================================

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
  dispute_id       UUID,  -- FK added after dispute table
  refunded_amount_sar NUMERIC(14,2) NOT NULL,
  refund_ratio     NUMERIC(5,4),
  decided_by_owner UUID NOT NULL REFERENCES admin_user(id),
  decided_by_accountant UUID NOT NULL REFERENCES admin_user(id),
  decided_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason           TEXT NOT NULL,
  CONSTRAINT four_eyes_distinct_approvers CHECK (decided_by_owner <> decided_by_accountant)
);

-- ============================================================================
-- FINANCIAL APPROVAL (generic four-eyes ledger for any sensitive action)
-- ============================================================================

CREATE TABLE financial_approval (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type    TEXT NOT NULL,   -- 'payment' / 'customs_fee' / 'dispute' / 'fx_rate' ...
  entity_id      UUID NOT NULL,
  action         TEXT NOT NULL,
  submitter_id   UUID NOT NULL REFERENCES admin_user(id),
  approver_id    UUID NOT NULL REFERENCES admin_user(id),
  submitted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at    TIMESTAMPTZ,
  CONSTRAINT no_self_approval CHECK (submitter_id <> approver_id)
);

-- ============================================================================
-- SHIPPING & CUSTOMS
-- ============================================================================

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

-- ============================================================================
-- PRODUCTION UPDATES
-- ============================================================================

CREATE TABLE production_update (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    UUID NOT NULL REFERENCES "order"(id),
  kind        TEXT NOT NULL,   -- 'text' / 'image' / 'invoice' / 'question'
  content     TEXT,
  file_url    TEXT,
  posted_by   TEXT NOT NULL,  -- 'SUPPLIER' / 'CUSTOMER'
  posted_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- ESCALATION (generalized to both customer and supplier — state-machine.md §4)
-- ============================================================================

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

-- ============================================================================
-- RENEWAL
-- ============================================================================

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

-- ============================================================================
-- DISPUTES
-- ============================================================================

CREATE TABLE dispute (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                      UUID NOT NULL REFERENCES "order"(id),
  type                          dispute_type NOT NULL,
  opened_by_role                TEXT NOT NULL,
  opened_at                     TIMESTAMPTZ NOT NULL DEFAULT now(),
  resume_target_state_snapshot  TEXT,   -- copy of Order.resume_target_state at open time, audit purposes
  status                        dispute_status NOT NULL DEFAULT 'OPEN',
  resolved_by                   UUID REFERENCES admin_user(id),
  resolved_at                   TIMESTAMPTZ,
  resolution_notes              TEXT
);

-- The actual DB-level enforcement of "no two concurrent open disputes per
-- order" (state-machine.md §0.3) — a second OPEN row for the same order_id
-- is rejected outright, not just discouraged by application logic.
CREATE UNIQUE INDEX one_open_dispute_per_order
  ON dispute (order_id) WHERE status = 'OPEN';

CREATE TABLE dispute_claim (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_id   UUID NOT NULL REFERENCES dispute(id),
  raised_by    TEXT NOT NULL,
  raised_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  description  TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'OPEN'
);

ALTER TABLE "order"
  ADD CONSTRAINT order_active_dispute_fk FOREIGN KEY (active_dispute_id) REFERENCES dispute(id);

ALTER TABLE refund_transaction
  ADD CONSTRAINT refund_transaction_dispute_fk FOREIGN KEY (dispute_id) REFERENCES dispute(id);

-- ============================================================================
-- SUPPLIER RATING
-- ============================================================================

CREATE TABLE supplier_rating (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_type   supplier_type NOT NULL,
  registered_supplier_id UUID REFERENCES registered_supplier(id),
  external_supplier_id   UUID REFERENCES external_supplier(id),
  order_id        UUID REFERENCES "order"(id),   -- nullable for pre-contract ratings
  phase           rating_phase NOT NULL,
  rated_by        UUID NOT NULL,
  score           INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- AUDIT LOG — append-only, hash-chained (data-model.md §7)
-- ============================================================================

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

-- ============================================================================
-- INTERNAL ACCOUNTING — physically decoupled from trust-fund tables
-- ============================================================================

CREATE TABLE company_expense (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category    TEXT NOT NULL,
  amount_sar  NUMERIC(14,2) NOT NULL,
  incurred_at DATE NOT NULL,
  notes       TEXT
  -- Deliberately no FK to "order"/payment — see data-model.md §9.
);

CREATE TABLE salary_accrual (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_ref          TEXT NOT NULL,
  period                DATE NOT NULL,
  accrued_amount_sar    NUMERIC(14,2) NOT NULL,
  is_actually_disbursed BOOLEAN NOT NULL DEFAULT false
);
-- Restrict SELECT on this table to OWNER/ACCOUNTANT roles via a dedicated
-- DB role or application-layer authorization — see data-model.md §1 matrix.
