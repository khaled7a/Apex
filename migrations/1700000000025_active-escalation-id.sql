-- Up Migration

-- Symmetric to `order.active_dispute_id` for disputes. Needed so
-- TransitionEngineService's generic hold-state bookkeeping can track the
-- currently-open escalation row the same way it already tracks the
-- currently-open dispute row, and so build-guard-context.ts can resolve
-- `ctx.escalationActor` automatically instead of requiring every caller to
-- pass it in manually (discovered during v2 planning: no code anywhere
-- actually populated ctx.escalationActor, so requireEscalationActor's check
-- was unimplementable end-to-end).
ALTER TABLE "order" ADD COLUMN active_escalation_id UUID REFERENCES escalation(id);

-- Down Migration

ALTER TABLE "order" DROP COLUMN IF EXISTS active_escalation_id;
