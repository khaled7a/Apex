-- Up Migration

-- Activates Row-Level Security for real. docs/schema.sql originally only
-- *documented* a policy on `offer` as a SQL comment — this migration builds
-- it for real, and generalizes it across every table a customer or
-- registered-supplier session can reach, using two session variables set by
-- the API's DbTransactionInterceptor via `SET LOCAL` at the start of every
-- request transaction:
--   app.actor_type ∈ {'ADMIN','CUSTOMER','SUPPLIER','SYSTEM'}
--   app.actor_id   = uuid of the current actor (unset for SYSTEM)
--
-- IMPORTANT operational note: RLS (even FORCE ROW LEVEL SECURITY) has no
-- effect on the table owner. The application must connect as `app_role`,
-- never as the role that owns these tables / ran the migrations.

-- ---- order ----
ALTER TABLE "order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "order" FORCE ROW LEVEL SECURITY;
CREATE POLICY order_isolation ON "order"
  USING (
    current_setting('app.actor_type', true) IN ('ADMIN', 'SYSTEM')
    OR (
      current_setting('app.actor_type', true) = 'CUSTOMER'
      AND customer_id = NULLIF(current_setting('app.actor_id', true), '')::uuid
    )
    OR (
      current_setting('app.actor_type', true) = 'SUPPLIER'
      AND registered_supplier_id = NULLIF(current_setting('app.actor_id', true), '')::uuid
    )
    -- A registered supplier may see the *bare* row while bidding is open,
    -- before any supplier has been awarded — but only through the
    -- `bidding_board` view below, which projects a narrow column set. This
    -- clause exists so that view (created with security_invoker) can read
    -- through to the base table for suppliers; the view itself hides
    -- customer-identifying columns.
    OR (
      current_setting('app.actor_type', true) = 'SUPPLIER'
      AND current_state IN ('REG_PUBLISHED', 'REG_BIDS_COLLECTING')
    )
  );

-- Narrow, read-only projection for suppliers browsing open orders before
-- being awarded — never expose customer identity or financial fields here.
CREATE VIEW bidding_board WITH (security_invoker = true) AS
SELECT o.id AS order_id, o.service_type_id, o.fob_value_usd, o.created_at
FROM "order" o
WHERE o.current_state IN ('REG_PUBLISHED', 'REG_BIDS_COLLECTING');

-- security_invoker views still require their own SELECT grant — the
-- underlying table's RLS policy alone is not enough.
GRANT SELECT ON bidding_board TO app_role;

-- ---- offer ---- (closed bidding: a supplier must never see another supplier's offer)
ALTER TABLE offer ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer FORCE ROW LEVEL SECURITY;
CREATE POLICY offer_isolation ON offer
  USING (
    current_setting('app.actor_type', true) IN ('ADMIN', 'SYSTEM')
    OR (
      current_setting('app.actor_type', true) = 'SUPPLIER'
      AND registered_supplier_id = NULLIF(current_setting('app.actor_id', true), '')::uuid
    )
  );

-- ---- contract / payment_plan / payment_installment / payment / receipt / refund_transaction ----
-- All reachable only via a join back to "order" — a customer sees their own
-- financial trail, a supplier never sees another supplier's or a customer's.
ALTER TABLE contract ENABLE ROW LEVEL SECURITY;
ALTER TABLE contract FORCE ROW LEVEL SECURITY;
CREATE POLICY contract_isolation ON contract
  USING (
    current_setting('app.actor_type', true) IN ('ADMIN', 'SYSTEM')
    OR EXISTS (
      SELECT 1 FROM "order" o
      WHERE o.id = contract.order_id
        AND (
          (current_setting('app.actor_type', true) = 'CUSTOMER' AND o.customer_id = NULLIF(current_setting('app.actor_id', true), '')::uuid)
          OR (current_setting('app.actor_type', true) = 'SUPPLIER' AND o.registered_supplier_id = NULLIF(current_setting('app.actor_id', true), '')::uuid)
        )
    )
  );

ALTER TABLE payment_plan ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_plan FORCE ROW LEVEL SECURITY;
CREATE POLICY payment_plan_isolation ON payment_plan
  USING (
    current_setting('app.actor_type', true) IN ('ADMIN', 'SYSTEM')
    OR EXISTS (
      SELECT 1 FROM contract c JOIN "order" o ON o.id = c.order_id
      WHERE c.id = payment_plan.contract_id
        AND (
          (current_setting('app.actor_type', true) = 'CUSTOMER' AND o.customer_id = NULLIF(current_setting('app.actor_id', true), '')::uuid)
          OR (current_setting('app.actor_type', true) = 'SUPPLIER' AND o.registered_supplier_id = NULLIF(current_setting('app.actor_id', true), '')::uuid)
        )
    )
  );

ALTER TABLE payment_installment ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_installment FORCE ROW LEVEL SECURITY;
CREATE POLICY payment_installment_isolation ON payment_installment
  USING (
    current_setting('app.actor_type', true) IN ('ADMIN', 'SYSTEM')
    OR EXISTS (
      SELECT 1 FROM payment_plan pp JOIN contract c ON c.id = pp.contract_id JOIN "order" o ON o.id = c.order_id
      WHERE pp.id = payment_installment.payment_plan_id
        AND (
          (current_setting('app.actor_type', true) = 'CUSTOMER' AND o.customer_id = NULLIF(current_setting('app.actor_id', true), '')::uuid)
          OR (current_setting('app.actor_type', true) = 'SUPPLIER' AND o.registered_supplier_id = NULLIF(current_setting('app.actor_id', true), '')::uuid)
        )
    )
  );

ALTER TABLE payment ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment FORCE ROW LEVEL SECURITY;
CREATE POLICY payment_isolation ON payment
  USING (
    current_setting('app.actor_type', true) IN ('ADMIN', 'SYSTEM')
    OR EXISTS (
      SELECT 1 FROM payment_installment pi
      JOIN payment_plan pp ON pp.id = pi.payment_plan_id
      JOIN contract c ON c.id = pp.contract_id
      JOIN "order" o ON o.id = c.order_id
      WHERE pi.id = payment.installment_id
        AND (
          (current_setting('app.actor_type', true) = 'CUSTOMER' AND o.customer_id = NULLIF(current_setting('app.actor_id', true), '')::uuid)
          OR (current_setting('app.actor_type', true) = 'SUPPLIER' AND o.registered_supplier_id = NULLIF(current_setting('app.actor_id', true), '')::uuid)
        )
    )
  );

ALTER TABLE receipt ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt FORCE ROW LEVEL SECURITY;
CREATE POLICY receipt_isolation ON receipt
  USING (
    current_setting('app.actor_type', true) IN ('ADMIN', 'SYSTEM')
    OR EXISTS (
      SELECT 1 FROM payment p
      JOIN payment_installment pi ON pi.id = p.installment_id
      JOIN payment_plan pp ON pp.id = pi.payment_plan_id
      JOIN contract c ON c.id = pp.contract_id
      JOIN "order" o ON o.id = c.order_id
      WHERE p.id = receipt.payment_id
        AND (
          (current_setting('app.actor_type', true) = 'CUSTOMER' AND o.customer_id = NULLIF(current_setting('app.actor_id', true), '')::uuid)
          OR (current_setting('app.actor_type', true) = 'SUPPLIER' AND o.registered_supplier_id = NULLIF(current_setting('app.actor_id', true), '')::uuid)
        )
    )
  );

ALTER TABLE refund_transaction ENABLE ROW LEVEL SECURITY;
ALTER TABLE refund_transaction FORCE ROW LEVEL SECURITY;
CREATE POLICY refund_transaction_isolation ON refund_transaction
  USING (current_setting('app.actor_type', true) IN ('ADMIN', 'SYSTEM'));
-- Deliberately admin-only (no customer/supplier branch): a refund decision
-- is an internal governance record, not something either party queries directly.

-- ---- order_id-direct tables: customs_fee, shipping_document, dispute, dispute_claim, agreement_renewal, production_update, escalation, state_transition_log ----
ALTER TABLE customs_fee ENABLE ROW LEVEL SECURITY;
ALTER TABLE customs_fee FORCE ROW LEVEL SECURITY;
-- NOTE on the tables below (customs_fee, shipping_document, dispute,
-- dispute_claim, agreement_renewal, production_update, escalation,
-- state_transition_log): these are only ever written by TransitionEngineService
-- or a service method *after* computeTransition()/role checks already
-- authorized the actor for this specific event — the write itself is not a
-- free-form user-supplied INSERT. Discovered by actually running the API: a
-- single combined USING clause (which Postgres also applies as the INSERT/
-- UPDATE "WITH CHECK") wrongly blocked a supplier's own `submit_offer` event
-- from writing its state_transition_log row, because during REG_BIDS_COLLECTING
-- the order isn't "theirs" yet by the strict registered_supplier_id match —
-- they haven't been awarded yet, that's the whole point of bidding. RLS here
-- exists to protect *read* privacy; it must not gate writes the application
-- has already authorized. So each of these tables gets a restrictive
-- FOR SELECT policy plus a permissive FOR INSERT/UPDATE/DELETE policy.

ALTER TABLE customs_fee ENABLE ROW LEVEL SECURITY;
ALTER TABLE customs_fee FORCE ROW LEVEL SECURITY;
CREATE POLICY customs_fee_read ON customs_fee FOR SELECT
  USING (
    current_setting('app.actor_type', true) IN ('ADMIN', 'SYSTEM')
    OR EXISTS (
      SELECT 1 FROM "order" o WHERE o.id = customs_fee.order_id
        AND current_setting('app.actor_type', true) = 'CUSTOMER'
        AND o.customer_id = NULLIF(current_setting('app.actor_id', true), '')::uuid
    )
  );
CREATE POLICY customs_fee_write ON customs_fee FOR INSERT WITH CHECK (true);
CREATE POLICY customs_fee_modify ON customs_fee FOR UPDATE USING (true);

ALTER TABLE shipping_document ENABLE ROW LEVEL SECURITY;
ALTER TABLE shipping_document FORCE ROW LEVEL SECURITY;
CREATE POLICY shipping_document_read ON shipping_document FOR SELECT
  USING (
    current_setting('app.actor_type', true) IN ('ADMIN', 'SYSTEM')
    OR EXISTS (
      SELECT 1 FROM "order" o WHERE o.id = shipping_document.order_id
        AND current_setting('app.actor_type', true) = 'CUSTOMER'
        AND o.customer_id = NULLIF(current_setting('app.actor_id', true), '')::uuid
    )
  );
CREATE POLICY shipping_document_write ON shipping_document FOR INSERT WITH CHECK (true);

ALTER TABLE dispute ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispute FORCE ROW LEVEL SECURITY;
CREATE POLICY dispute_read ON dispute FOR SELECT
  USING (
    current_setting('app.actor_type', true) IN ('ADMIN', 'SYSTEM')
    OR EXISTS (
      SELECT 1 FROM "order" o WHERE o.id = dispute.order_id
        AND (
          (current_setting('app.actor_type', true) = 'CUSTOMER' AND o.customer_id = NULLIF(current_setting('app.actor_id', true), '')::uuid)
          OR (current_setting('app.actor_type', true) = 'SUPPLIER' AND o.registered_supplier_id = NULLIF(current_setting('app.actor_id', true), '')::uuid)
        )
    )
  );
CREATE POLICY dispute_write ON dispute FOR INSERT WITH CHECK (true);
CREATE POLICY dispute_modify ON dispute FOR UPDATE USING (true);

ALTER TABLE dispute_claim ENABLE ROW LEVEL SECURITY;
ALTER TABLE dispute_claim FORCE ROW LEVEL SECURITY;
CREATE POLICY dispute_claim_read ON dispute_claim FOR SELECT
  USING (
    current_setting('app.actor_type', true) IN ('ADMIN', 'SYSTEM')
    OR EXISTS (
      SELECT 1 FROM dispute d JOIN "order" o ON o.id = d.order_id
      WHERE d.id = dispute_claim.dispute_id
        AND (
          (current_setting('app.actor_type', true) = 'CUSTOMER' AND o.customer_id = NULLIF(current_setting('app.actor_id', true), '')::uuid)
          OR (current_setting('app.actor_type', true) = 'SUPPLIER' AND o.registered_supplier_id = NULLIF(current_setting('app.actor_id', true), '')::uuid)
        )
    )
  );
CREATE POLICY dispute_claim_write ON dispute_claim FOR INSERT WITH CHECK (true);

ALTER TABLE agreement_renewal ENABLE ROW LEVEL SECURITY;
ALTER TABLE agreement_renewal FORCE ROW LEVEL SECURITY;
CREATE POLICY agreement_renewal_read ON agreement_renewal FOR SELECT
  USING (
    current_setting('app.actor_type', true) IN ('ADMIN', 'SYSTEM')
    OR EXISTS (
      SELECT 1 FROM "order" o WHERE o.id = agreement_renewal.order_id
        AND (
          (current_setting('app.actor_type', true) = 'CUSTOMER' AND o.customer_id = NULLIF(current_setting('app.actor_id', true), '')::uuid)
          OR (current_setting('app.actor_type', true) = 'SUPPLIER' AND o.registered_supplier_id = NULLIF(current_setting('app.actor_id', true), '')::uuid)
        )
    )
  );
CREATE POLICY agreement_renewal_write ON agreement_renewal FOR INSERT WITH CHECK (true);
CREATE POLICY agreement_renewal_modify ON agreement_renewal FOR UPDATE USING (true);

ALTER TABLE production_update ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_update FORCE ROW LEVEL SECURITY;
CREATE POLICY production_update_read ON production_update FOR SELECT
  USING (
    current_setting('app.actor_type', true) IN ('ADMIN', 'SYSTEM')
    OR EXISTS (
      SELECT 1 FROM "order" o WHERE o.id = production_update.order_id
        AND (
          (current_setting('app.actor_type', true) = 'CUSTOMER' AND o.customer_id = NULLIF(current_setting('app.actor_id', true), '')::uuid)
          OR (current_setting('app.actor_type', true) = 'SUPPLIER' AND o.registered_supplier_id = NULLIF(current_setting('app.actor_id', true), '')::uuid)
        )
    )
  );
CREATE POLICY production_update_write ON production_update FOR INSERT WITH CHECK (true);

ALTER TABLE escalation ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalation FORCE ROW LEVEL SECURITY;
CREATE POLICY escalation_read ON escalation FOR SELECT
  USING (
    current_setting('app.actor_type', true) IN ('ADMIN', 'SYSTEM')
    OR EXISTS (
      SELECT 1 FROM "order" o WHERE o.id = escalation.order_id
        AND (
          (current_setting('app.actor_type', true) = 'CUSTOMER' AND o.customer_id = NULLIF(current_setting('app.actor_id', true), '')::uuid)
          OR (current_setting('app.actor_type', true) = 'SUPPLIER' AND o.registered_supplier_id = NULLIF(current_setting('app.actor_id', true), '')::uuid)
        )
    )
  );
CREATE POLICY escalation_write ON escalation FOR INSERT WITH CHECK (true);
CREATE POLICY escalation_modify ON escalation FOR UPDATE USING (true);

ALTER TABLE state_transition_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE state_transition_log FORCE ROW LEVEL SECURITY;
CREATE POLICY state_transition_log_read ON state_transition_log FOR SELECT
  USING (
    current_setting('app.actor_type', true) IN ('ADMIN', 'SYSTEM')
    OR EXISTS (
      SELECT 1 FROM "order" o WHERE o.id = state_transition_log.order_id
        AND (
          (current_setting('app.actor_type', true) = 'CUSTOMER' AND o.customer_id = NULLIF(current_setting('app.actor_id', true), '')::uuid)
          OR (current_setting('app.actor_type', true) = 'SUPPLIER' AND o.registered_supplier_id = NULLIF(current_setting('app.actor_id', true), '')::uuid)
        )
    )
  );
CREATE POLICY state_transition_log_write ON state_transition_log FOR INSERT WITH CHECK (true);
CREATE POLICY state_transition_log_modify ON state_transition_log FOR UPDATE USING (true);

-- Down Migration

DROP POLICY IF EXISTS state_transition_log_modify ON state_transition_log;
DROP POLICY IF EXISTS state_transition_log_write ON state_transition_log;
DROP POLICY IF EXISTS state_transition_log_read ON state_transition_log;
ALTER TABLE state_transition_log NO FORCE ROW LEVEL SECURITY;
ALTER TABLE state_transition_log DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS escalation_modify ON escalation;
DROP POLICY IF EXISTS escalation_write ON escalation;
DROP POLICY IF EXISTS escalation_read ON escalation;
ALTER TABLE escalation NO FORCE ROW LEVEL SECURITY;
ALTER TABLE escalation DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS production_update_write ON production_update;
DROP POLICY IF EXISTS production_update_read ON production_update;
ALTER TABLE production_update NO FORCE ROW LEVEL SECURITY;
ALTER TABLE production_update DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS agreement_renewal_modify ON agreement_renewal;
DROP POLICY IF EXISTS agreement_renewal_write ON agreement_renewal;
DROP POLICY IF EXISTS agreement_renewal_read ON agreement_renewal;
ALTER TABLE agreement_renewal NO FORCE ROW LEVEL SECURITY;
ALTER TABLE agreement_renewal DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dispute_claim_write ON dispute_claim;
DROP POLICY IF EXISTS dispute_claim_read ON dispute_claim;
ALTER TABLE dispute_claim NO FORCE ROW LEVEL SECURITY;
ALTER TABLE dispute_claim DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dispute_modify ON dispute;
DROP POLICY IF EXISTS dispute_write ON dispute;
DROP POLICY IF EXISTS dispute_read ON dispute;
ALTER TABLE dispute NO FORCE ROW LEVEL SECURITY;
ALTER TABLE dispute DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shipping_document_write ON shipping_document;
DROP POLICY IF EXISTS shipping_document_read ON shipping_document;
ALTER TABLE shipping_document NO FORCE ROW LEVEL SECURITY;
ALTER TABLE shipping_document DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS customs_fee_modify ON customs_fee;
DROP POLICY IF EXISTS customs_fee_write ON customs_fee;
DROP POLICY IF EXISTS customs_fee_read ON customs_fee;
ALTER TABLE customs_fee NO FORCE ROW LEVEL SECURITY;
ALTER TABLE customs_fee DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS refund_transaction_isolation ON refund_transaction;
ALTER TABLE refund_transaction NO FORCE ROW LEVEL SECURITY;
ALTER TABLE refund_transaction DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS receipt_isolation ON receipt;
ALTER TABLE receipt NO FORCE ROW LEVEL SECURITY;
ALTER TABLE receipt DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_isolation ON payment;
ALTER TABLE payment NO FORCE ROW LEVEL SECURITY;
ALTER TABLE payment DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_installment_isolation ON payment_installment;
ALTER TABLE payment_installment NO FORCE ROW LEVEL SECURITY;
ALTER TABLE payment_installment DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_plan_isolation ON payment_plan;
ALTER TABLE payment_plan NO FORCE ROW LEVEL SECURITY;
ALTER TABLE payment_plan DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contract_isolation ON contract;
ALTER TABLE contract NO FORCE ROW LEVEL SECURITY;
ALTER TABLE contract DISABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS offer_isolation ON offer;
ALTER TABLE offer NO FORCE ROW LEVEL SECURITY;
ALTER TABLE offer DISABLE ROW LEVEL SECURITY;

DROP VIEW IF EXISTS bidding_board;

DROP POLICY IF EXISTS order_isolation ON "order";
ALTER TABLE "order" NO FORCE ROW LEVEL SECURITY;
ALTER TABLE "order" DISABLE ROW LEVEL SECURITY;
