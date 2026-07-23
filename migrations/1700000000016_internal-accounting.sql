-- Up Migration

CREATE TABLE company_expense (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category    TEXT NOT NULL,
  amount_sar  NUMERIC(14,2) NOT NULL,
  incurred_at DATE NOT NULL,
  notes       TEXT
  -- Deliberately no FK to "order"/payment — see data-model.md §9.
);

CREATE TABLE salary_accrual (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_ref          TEXT NOT NULL,
  period                DATE NOT NULL,
  accrued_amount_sar    NUMERIC(14,2) NOT NULL,
  is_actually_disbursed BOOLEAN NOT NULL DEFAULT false
);
-- Restrict SELECT on this table to OWNER/ACCOUNTANT roles via a dedicated
-- DB role or application-layer authorization — see data-model.md §1 matrix.

-- Down Migration

DROP TABLE IF EXISTS salary_accrual;
DROP TABLE IF EXISTS company_expense;
