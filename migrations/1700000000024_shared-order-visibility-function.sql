-- Up Migration

-- Discovered during review: the customer/supplier ownership check
-- (current_setting('app.actor_type')='CUSTOMER' AND o.customer_id=... OR
-- 'SUPPLIER' AND o.registered_supplier_id=...) was hand-copied verbatim,
-- growing one join deeper each time, across contract/payment_plan/
-- payment_installment/payment/receipt/dispute/dispute_claim/
-- agreement_renewal/production_update/escalation/state_transition_log's
-- read policies in 1700000000018_rls-policies.sql. That copy-paste pattern
-- is exactly what let migration 1700000000022 slip through as a bolt-on
-- patch instead of a fix to the original `offer_isolation` policy. This
-- migration factors the ownership check into one function so there is a
-- single place to fix it next time, and folds offer_customer_read back into
-- offer_isolation where it always belonged.
--
-- NOTE: customs_fee_read and shipping_document_read are intentionally left
-- untouched — they deliberately grant CUSTOMER (not SUPPLIER) visibility
-- only, a narrower rule than this function encodes, so reusing it there
-- would silently widen supplier access to customs/shipping documents.
CREATE FUNCTION order_visible_to_actor(target_order_id uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT
    current_setting('app.actor_type', true) IN ('ADMIN', 'SYSTEM')
    OR EXISTS (
      SELECT 1 FROM "order" o
      WHERE o.id = target_order_id
        AND (
          (current_setting('app.actor_type', true) = 'CUSTOMER' AND o.customer_id = NULLIF(current_setting('app.actor_id', true), '')::uuid)
          OR (current_setting('app.actor_type', true) = 'SUPPLIER' AND o.registered_supplier_id = NULLIF(current_setting('app.actor_id', true), '')::uuid)
        )
    );
$$;

ALTER POLICY contract_isolation ON contract USING (order_visible_to_actor(contract.order_id));

ALTER POLICY payment_plan_isolation ON payment_plan USING (
  EXISTS (SELECT 1 FROM contract c WHERE c.id = payment_plan.contract_id AND order_visible_to_actor(c.order_id))
);

ALTER POLICY payment_installment_isolation ON payment_installment USING (
  EXISTS (
    SELECT 1 FROM payment_plan pp JOIN contract c ON c.id = pp.contract_id
    WHERE pp.id = payment_installment.payment_plan_id AND order_visible_to_actor(c.order_id)
  )
);

ALTER POLICY payment_isolation ON payment USING (
  EXISTS (
    SELECT 1 FROM payment_installment pi
    JOIN payment_plan pp ON pp.id = pi.payment_plan_id
    JOIN contract c ON c.id = pp.contract_id
    WHERE pi.id = payment.installment_id AND order_visible_to_actor(c.order_id)
  )
);

ALTER POLICY receipt_isolation ON receipt USING (
  EXISTS (
    SELECT 1 FROM payment p
    JOIN payment_installment pi ON pi.id = p.installment_id
    JOIN payment_plan pp ON pp.id = pi.payment_plan_id
    JOIN contract c ON c.id = pp.contract_id
    WHERE p.id = receipt.payment_id AND order_visible_to_actor(c.order_id)
  )
);

ALTER POLICY dispute_read ON dispute USING (order_visible_to_actor(dispute.order_id));

ALTER POLICY dispute_claim_read ON dispute_claim USING (
  EXISTS (SELECT 1 FROM dispute d WHERE d.id = dispute_claim.dispute_id AND order_visible_to_actor(d.order_id))
);

ALTER POLICY agreement_renewal_read ON agreement_renewal USING (order_visible_to_actor(agreement_renewal.order_id));

ALTER POLICY production_update_read ON production_update USING (order_visible_to_actor(production_update.order_id));

ALTER POLICY escalation_read ON escalation USING (order_visible_to_actor(escalation.order_id));

ALTER POLICY state_transition_log_read ON state_transition_log USING (order_visible_to_actor(state_transition_log.order_id));

-- Fold the bolted-on offer_customer_read (1700000000022) into the original
-- offer_isolation policy it should always have covered. Not using
-- order_visible_to_actor() here: offer's SUPPLIER branch deliberately checks
-- offer.registered_supplier_id (the actual offerer) rather than
-- order.registered_supplier_id (the eventual bid winner, still null during
-- REG_BIDS_COLLECTING) — a genuinely different rule, not the same
-- duplication this migration otherwise targets.
ALTER POLICY offer_isolation ON offer USING (
  current_setting('app.actor_type', true) IN ('ADMIN', 'SYSTEM')
  OR (
    current_setting('app.actor_type', true) = 'SUPPLIER'
    AND registered_supplier_id = NULLIF(current_setting('app.actor_id', true), '')::uuid
  )
  OR (
    current_setting('app.actor_type', true) = 'CUSTOMER'
    AND EXISTS (
      SELECT 1 FROM "order" o
      WHERE o.id = offer.order_id
        AND o.customer_id = NULLIF(current_setting('app.actor_id', true), '')::uuid
    )
  )
);
DROP POLICY IF EXISTS offer_customer_read ON offer;

-- Down Migration

CREATE POLICY offer_customer_read ON offer FOR SELECT
  USING (
    current_setting('app.actor_type', true) = 'CUSTOMER'
    AND EXISTS (
      SELECT 1 FROM "order" o
      WHERE o.id = offer.order_id
        AND o.customer_id = NULLIF(current_setting('app.actor_id', true), '')::uuid
    )
  );
ALTER POLICY offer_isolation ON offer USING (
  current_setting('app.actor_type', true) IN ('ADMIN', 'SYSTEM')
  OR (
    current_setting('app.actor_type', true) = 'SUPPLIER'
    AND registered_supplier_id = NULLIF(current_setting('app.actor_id', true), '')::uuid
  )
);

ALTER POLICY state_transition_log_read ON state_transition_log USING (
  current_setting('app.actor_type', true) IN ('ADMIN', 'SYSTEM')
  OR EXISTS (
    SELECT 1 FROM "order" o WHERE o.id = state_transition_log.order_id
      AND (
        (current_setting('app.actor_type', true) = 'CUSTOMER' AND o.customer_id = NULLIF(current_setting('app.actor_id', true), '')::uuid)
        OR (current_setting('app.actor_type', true) = 'SUPPLIER' AND o.registered_supplier_id = NULLIF(current_setting('app.actor_id', true), '')::uuid)
      )
  )
);

ALTER POLICY escalation_read ON escalation USING (
  current_setting('app.actor_type', true) IN ('ADMIN', 'SYSTEM')
  OR EXISTS (
    SELECT 1 FROM "order" o WHERE o.id = escalation.order_id
      AND (
        (current_setting('app.actor_type', true) = 'CUSTOMER' AND o.customer_id = NULLIF(current_setting('app.actor_id', true), '')::uuid)
        OR (current_setting('app.actor_type', true) = 'SUPPLIER' AND o.registered_supplier_id = NULLIF(current_setting('app.actor_id', true), '')::uuid)
      )
  )
);

ALTER POLICY production_update_read ON production_update USING (
  current_setting('app.actor_type', true) IN ('ADMIN', 'SYSTEM')
  OR EXISTS (
    SELECT 1 FROM "order" o WHERE o.id = production_update.order_id
      AND (
        (current_setting('app.actor_type', true) = 'CUSTOMER' AND o.customer_id = NULLIF(current_setting('app.actor_id', true), '')::uuid)
        OR (current_setting('app.actor_type', true) = 'SUPPLIER' AND o.registered_supplier_id = NULLIF(current_setting('app.actor_id', true), '')::uuid)
      )
  )
);

ALTER POLICY agreement_renewal_read ON agreement_renewal USING (
  current_setting('app.actor_type', true) IN ('ADMIN', 'SYSTEM')
  OR EXISTS (
    SELECT 1 FROM "order" o WHERE o.id = agreement_renewal.order_id
      AND (
        (current_setting('app.actor_type', true) = 'CUSTOMER' AND o.customer_id = NULLIF(current_setting('app.actor_id', true), '')::uuid)
        OR (current_setting('app.actor_type', true) = 'SUPPLIER' AND o.registered_supplier_id = NULLIF(current_setting('app.actor_id', true), '')::uuid)
      )
  )
);

ALTER POLICY dispute_claim_read ON dispute_claim USING (
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

ALTER POLICY dispute_read ON dispute USING (
  current_setting('app.actor_type', true) IN ('ADMIN', 'SYSTEM')
  OR EXISTS (
    SELECT 1 FROM "order" o WHERE o.id = dispute.order_id
      AND (
        (current_setting('app.actor_type', true) = 'CUSTOMER' AND o.customer_id = NULLIF(current_setting('app.actor_id', true), '')::uuid)
        OR (current_setting('app.actor_type', true) = 'SUPPLIER' AND o.registered_supplier_id = NULLIF(current_setting('app.actor_id', true), '')::uuid)
      )
  )
);

ALTER POLICY receipt_isolation ON receipt USING (
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

ALTER POLICY payment_isolation ON payment USING (
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

ALTER POLICY payment_installment_isolation ON payment_installment USING (
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

ALTER POLICY payment_plan_isolation ON payment_plan USING (
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

ALTER POLICY contract_isolation ON contract USING (
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

DROP FUNCTION IF EXISTS order_visible_to_actor(uuid);
