-- Up Migration

-- Outbox table for every timed event the state machine needs (bidding
-- deadline, customer/supplier SLA, escalation timeout). Did not exist in the
-- original docs/schema.sql — added while building the actual scheduler
-- (docs/state-machine.md's timer semantics required somewhere durable to
-- record "when" and to cancel atomically inside the same transition
-- transaction, see the implementation plan appended to the review doc).
CREATE TABLE scheduled_timer (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                UUID NOT NULL REFERENCES "order"(id),
  timer_type              TEXT NOT NULL,          -- 'BIDDING_DEADLINE' / 'CUSTOMER_SLA' / 'SUPPLIER_SLA' / 'ESCALATION_TIMEOUT'
  run_at                  TIMESTAMPTZ NOT NULL,
  expected_state_version  INTEGER NOT NULL,       -- defensive re-check before the handler fires
  cancelled_at            TIMESTAMPTZ,
  pg_boss_job_id          UUID,                   -- best-effort link to the actual pg-boss job; NOT the source of truth
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- At most one *active* timer of a given type per order — cancellation is a
-- single atomic UPDATE inside the same transaction as the transition that
-- invalidates it, never a call out to an external scheduler API.
CREATE UNIQUE INDEX one_active_timer_per_order_and_type
  ON scheduled_timer (order_id, timer_type) WHERE cancelled_at IS NULL;

CREATE INDEX idx_scheduled_timer_due ON scheduled_timer (run_at) WHERE cancelled_at IS NULL;

-- Down Migration

DROP INDEX IF EXISTS idx_scheduled_timer_due;
DROP INDEX IF EXISTS one_active_timer_per_order_and_type;
DROP TABLE IF EXISTS scheduled_timer;
