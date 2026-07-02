-- Up Migration

CREATE TABLE supplier_rating (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_type   supplier_type NOT NULL,
  registered_supplier_id UUID REFERENCES registered_supplier(id),
  external_supplier_id   UUID REFERENCES external_supplier(id),
  order_id        UUID REFERENCES "order"(id),   -- nullable for pre-contract ratings
  phase           rating_phase NOT NULL,
  rated_by        UUID NOT NULL,
  score           INTEGER NOT NULL CHECK (score BETWEEN 1 AND 5),
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Down Migration

DROP TABLE IF EXISTS supplier_rating;
