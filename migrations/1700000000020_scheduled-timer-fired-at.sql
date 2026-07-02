-- Up Migration

-- Distinguishes "cancelled" (superseded before it was due — e.g. the
-- customer responded before the SLA expired) from "fired" (actually
-- processed by the worker). Without this, a fired timer would keep
-- satisfying `one_active_timer_per_order_and_type`'s "no active timer"
-- condition forever, blocking a legitimate new timer of the same type from
-- ever being scheduled again for that order (e.g. after `extend_deadline`).
ALTER TABLE scheduled_timer ADD COLUMN fired_at TIMESTAMPTZ;

DROP INDEX one_active_timer_per_order_and_type;
CREATE UNIQUE INDEX one_active_timer_per_order_and_type
  ON scheduled_timer (order_id, timer_type) WHERE cancelled_at IS NULL AND fired_at IS NULL;

-- Down Migration

DROP INDEX IF EXISTS one_active_timer_per_order_and_type;
CREATE UNIQUE INDEX one_active_timer_per_order_and_type
  ON scheduled_timer (order_id, timer_type) WHERE cancelled_at IS NULL;
ALTER TABLE scheduled_timer DROP COLUMN IF EXISTS fired_at;
