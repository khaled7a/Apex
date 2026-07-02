-- Up Migration

-- Gap found while actually running the full v1 flow: the original
-- offer_isolation policy (admin/system, or the owning supplier) never gave
-- the CUSTOMER any read access to their own order's offers — so
-- BiddingService.selectOffer() couldn't even find the row to select it.
-- RLS in Postgres ORs together every permissive policy that applies to a
-- given command, so this is added as an independent FOR SELECT policy
-- rather than editing offer_isolation itself.
--
-- Note: this grants row visibility only — it is still the controller/DTO's
-- job to anonymize supplier identity ("Supplier A/B/C") before the closed
-- bidding round concludes; RLS decides *whether* a row is visible, not which
-- columns get serialized back to the client.
CREATE POLICY offer_customer_read ON offer FOR SELECT
  USING (
    current_setting('app.actor_type', true) = 'CUSTOMER'
    AND EXISTS (
      SELECT 1 FROM "order" o
      WHERE o.id = offer.order_id
        AND o.customer_id = NULLIF(current_setting('app.actor_id', true), '')::uuid
    )
  );

-- Down Migration

DROP POLICY IF EXISTS offer_customer_read ON offer;
