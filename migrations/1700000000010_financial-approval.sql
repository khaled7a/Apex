-- Up Migration

CREATE TABLE financial_approval (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type    TEXT NOT NULL,   -- 'payment' / 'customs_fee' / 'dispute' / 'fx_rate' ...
  entity_id      UUID NOT NULL,
  action         TEXT NOT NULL,
  submitter_id   UUID NOT NULL REFERENCES admin_user(id),
  approver_id    UUID NOT NULL REFERENCES admin_user(id),
  submitted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  approved_at    TIMESTAMPTZ,
  CONSTRAINT no_self_approval CHECK (submitter_id <> approver_id)
);

-- Down Migration

DROP TABLE IF EXISTS financial_approval;
