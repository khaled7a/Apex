-- Up Migration

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
  active_dispute_id               UUID,                             -- FK added in the disputes migration

  financial_commitment_started_at TIMESTAMPTZ,                      -- written once, first SUPPLIER_PAYMENT_CONFIRMED
  fx_rate_used                    NUMERIC(12,6),
  fx_rate_source                  TEXT,
  fx_rate_entered_by              UUID REFERENCES admin_user(id),
  fx_rate_deviation_flag          BOOLEAN NOT NULL DEFAULT false,
  fob_value_usd                   NUMERIC(14,2),
  final_value_sar                 NUMERIC(14,2),
  low_competition_offer           BOOLEAN NOT NULL DEFAULT false,

  created_at                      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- NOTE: for REGISTERED, registered_supplier_id starts NULL and is only
  -- filled in once a specific supplier wins the closed bidding round
  -- (REG_CUSTOMER_SELECTS) — the sourcing *mode* is chosen at approval time,
  -- long before the specific supplier is known. EXTERNAL is the opposite:
  -- the customer already brought a specific supplier, so external_supplier_id
  -- must be set immediately. An earlier draft of this constraint wrongly
  -- required registered_supplier_id NOT NULL for REGISTERED from the start,
  -- which made the real approve-then-bid workflow impossible to represent.
  CONSTRAINT supplier_ref_matches_type CHECK (
    (supplier_type = 'REGISTERED' AND external_supplier_id IS NULL) OR
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
-- (see `one_open_dispute_per_order` in the disputes migration).

CREATE INDEX idx_order_customer ON "order"(customer_id);
CREATE INDEX idx_order_state ON "order"(current_state);

-- Down Migration

DROP INDEX IF EXISTS idx_order_state;
DROP INDEX IF EXISTS idx_order_customer;
ALTER TABLE external_supplier DROP CONSTRAINT IF EXISTS external_supplier_order_fk;
DROP TABLE IF EXISTS "order";
