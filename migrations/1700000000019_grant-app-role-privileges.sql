-- Up Migration

-- Gap found while wiring up the actual database connection: docs/schema.sql
-- never granted app_role any privileges on tables other than audit_log (which
-- has its own deliberately-narrower grant). Without this, an application
-- connecting as app_role — which it must, for RLS/REVOKE to mean anything —
-- gets `permission denied` on every query. This grants the ordinary DML
-- privileges app_role needs, table by table (not a blanket ALL TABLES, so
-- audit_log's tighter grant from the audit-log migration is never touched).

GRANT SELECT, INSERT, UPDATE ON
  customer, admin_user,
  supplier_category, registered_supplier, supplier_category_map, external_supplier,
  service_type,
  "order",
  state_transition_log,
  offer, contract, payment_plan, payment_installment,
  payment, receipt, refund_transaction,
  financial_approval,
  shipping_document, customs_fee,
  production_update, escalation, agreement_renewal,
  dispute, dispute_claim,
  supplier_rating,
  scheduled_timer,
  company_expense, salary_accrual
TO app_role;

-- Sequences backing the BIGSERIAL columns on tables above (audit_log's
-- sequence is granted separately in the audit-log migration).
GRANT USAGE, SELECT ON SEQUENCE state_transition_log_id_seq TO app_role;

-- Down Migration

REVOKE SELECT, INSERT, UPDATE ON
  customer, admin_user,
  supplier_category, registered_supplier, supplier_category_map, external_supplier,
  service_type,
  "order",
  state_transition_log,
  offer, contract, payment_plan, payment_installment,
  payment, receipt, refund_transaction,
  financial_approval,
  shipping_document, customs_fee,
  production_update, escalation, agreement_renewal,
  dispute, dispute_claim,
  supplier_rating,
  scheduled_timer,
  company_expense, salary_accrual
FROM app_role;

REVOKE USAGE, SELECT ON SEQUENCE state_transition_log_id_seq FROM app_role;
