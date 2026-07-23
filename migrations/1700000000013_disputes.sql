-- Up Migration

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
-- is rejected outright, not just discouraged by application logic. (This
-- replaces a broken first attempt that lived on "order"(id) — see data-model.md §2.)
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

-- Down Migration

ALTER TABLE refund_transaction DROP CONSTRAINT IF EXISTS refund_transaction_dispute_fk;
ALTER TABLE "order" DROP CONSTRAINT IF EXISTS order_active_dispute_fk;
DROP TABLE IF EXISTS dispute_claim;
DROP INDEX IF EXISTS one_open_dispute_per_order;
DROP TABLE IF EXISTS dispute;
