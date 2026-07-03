-- Up Migration

-- Discovered while wiring up the renewal path: TransitionEngineService's
-- generic hold-state bookkeeping treats leaving ESCALATION_ESCALATED into any
-- non-dispute, non-escalation state as "fully left the hold" and wipes
-- resume_target_state — but AGREEMENT_CANCELLED_PENDING_RENEWAL/RENEWAL_* are
-- a continuation of that same wait, not a resumption. Without a third hold
-- type, resume_target_state would be erased before admin_approves ever gets
-- to use it, silently losing real progress (an order frozen at
-- PROD_CHECKPOINT_2 would incorrectly restart at PROD_DESIGN_SUBMITTED).
ALTER TYPE hold_type ADD VALUE 'RENEWAL';

-- Down Migration

-- Postgres does not support removing a value from an existing ENUM type —
-- there is no clean DROP VALUE. Rolling back this migration requires
-- recreating the type from scratch (out of scope for a routine down
-- migration); intentionally a no-op here, consistent with this being a
-- purely additive, backward-compatible change.
