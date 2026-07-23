-- Up Migration

-- Gap found while designing the supplier's "my pending offers" list: once
-- bidding closes (REG_ADMIN_REVIEW_BIDS onward, before a winner is picked in
-- REG_CUSTOMER_SELECTS), order_isolation's existing SUPPLIER clauses stop
-- matching — the bidding_board clause only covers REG_PUBLISHED/
-- REG_BIDS_COLLECTING, and registered_supplier_id isn't set until a winner
-- is chosen. A supplier who genuinely has an offer on the order would get
-- zero order-side columns for exactly this in-flight window. Scoped as
-- narrowly as the gap itself — only these three states, and only when the
-- supplier actually has an offer row — not a general widening of supplier
-- visibility.
--
-- A plain `EXISTS (SELECT 1 FROM offer WHERE ...)` inside order_isolation
-- was tried first and hit "infinite recursion detected in policy for
-- relation order" at runtime: evaluating offer's own RLS policy
-- (offer_isolation) requires evaluating its CUSTOMER branch, which queries
-- "order" again, re-triggering order_isolation — a genuine order<->offer
-- policy cycle, unlike order_visible_to_actor's existing one-way
-- other-table->order reads. A SECURITY DEFINER function breaks the cycle by
-- reading `offer` as its owner (this migration's role, which — per the note
-- below — already bypasses RLS entirely), so the check never re-enters
-- offer_isolation. It enforces the exact same restriction offer_isolation's
-- own SUPPLIER branch would (registered_supplier_id = the calling
-- supplier), just without routing through RLS to get there.
CREATE FUNCTION supplier_has_offer_on_order(target_order_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM offer
    WHERE offer.order_id = target_order_id
      AND offer.registered_supplier_id = NULLIF(current_setting('app.actor_id', true), '')::uuid
  );
$$;

-- Following the order_visible_to_actor precedent (1700000000024): fold into
-- the existing policy via ALTER POLICY rather than bolting on a separate one.
ALTER POLICY order_isolation ON "order" USING (
  current_setting('app.actor_type', true) IN ('ADMIN', 'SYSTEM')
  OR (
    current_setting('app.actor_type', true) = 'CUSTOMER'
    AND customer_id = NULLIF(current_setting('app.actor_id', true), '')::uuid
  )
  OR (
    current_setting('app.actor_type', true) = 'SUPPLIER'
    AND registered_supplier_id = NULLIF(current_setting('app.actor_id', true), '')::uuid
  )
  OR (
    current_setting('app.actor_type', true) = 'SUPPLIER'
    AND current_state IN ('REG_PUBLISHED', 'REG_BIDS_COLLECTING')
  )
  OR (
    current_setting('app.actor_type', true) = 'SUPPLIER'
    AND current_state IN ('REG_ADMIN_REVIEW_BIDS', 'REG_SHOWN_TO_CUSTOMER', 'REG_CUSTOMER_SELECTS')
    AND supplier_has_offer_on_order("order".id)
  )
);

-- Down Migration

ALTER POLICY order_isolation ON "order" USING (
  current_setting('app.actor_type', true) IN ('ADMIN', 'SYSTEM')
  OR (
    current_setting('app.actor_type', true) = 'CUSTOMER'
    AND customer_id = NULLIF(current_setting('app.actor_id', true), '')::uuid
  )
  OR (
    current_setting('app.actor_type', true) = 'SUPPLIER'
    AND registered_supplier_id = NULLIF(current_setting('app.actor_id', true), '')::uuid
  )
  OR (
    current_setting('app.actor_type', true) = 'SUPPLIER'
    AND current_state IN ('REG_PUBLISHED', 'REG_BIDS_COLLECTING')
  )
);

DROP FUNCTION IF EXISTS supplier_has_offer_on_order(uuid);
