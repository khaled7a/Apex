-- Up Migration

CREATE TABLE state_transition_log (
  id            BIGSERIAL PRIMARY KEY,
  order_id      UUID NOT NULL REFERENCES "order"(id),
  from_state    order_state,
  to_state      order_state NOT NULL,
  event         TEXT NOT NULL,
  acted_by_role TEXT NOT NULL,             -- 'CUSTOMER' / 'SUPPLIER' / 'ADMIN' / 'SYSTEM'
  acted_by_id   UUID,
  entered_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  exited_at     TIMESTAMPTZ,               -- filled in when the NEXT transition happens
  payload       JSONB
);

CREATE INDEX idx_stl_order ON state_transition_log(order_id, entered_at);

-- Down Migration

DROP TABLE IF EXISTS state_transition_log;
