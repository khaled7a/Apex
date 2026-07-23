import { describe, expect, it } from 'vitest';
import { isActionAllowed, requiresFourEyes, PERMISSION_MATRIX } from './permission-matrix.const';

describe('permission matrix — docs/data-model.md §1', () => {
  it('OPERATOR cannot approve/reject orders is false — OPERATOR IS allowed (matrix: OWNER✅ OPERATOR✅)', () => {
    expect(isActionAllowed('ORDER_APPROVE_EDIT_REJECT', 'ADMIN_OPERATOR')).toBe(true);
  });

  it('ACCOUNTANT cannot approve/reject orders', () => {
    expect(isActionAllowed('ORDER_APPROVE_EDIT_REJECT', 'ADMIN_ACCOUNTANT')).toBe(false);
  });

  it('only OWNER can finalize external supplier vetting, and it requires four-eyes', () => {
    expect(isActionAllowed('EXTERNAL_SUPPLIER_FINAL_APPROVAL', 'ADMIN_OWNER')).toBe(true);
    expect(isActionAllowed('EXTERNAL_SUPPLIER_FINAL_APPROVAL', 'ADMIN_OPERATOR')).toBe(false);
    expect(requiresFourEyes('EXTERNAL_SUPPLIER_FINAL_APPROVAL')).toBe(true);
  });

  it('supplier payment admin-verification requires four-eyes and allows all three roles', () => {
    expect(requiresFourEyes('SUPPLIER_PAYMENT_ADMIN_VERIFICATION')).toBe(true);
    for (const role of ['ADMIN_OWNER', 'ADMIN_OPERATOR', 'ADMIN_ACCOUNTANT'] as const) {
      expect(isActionAllowed('SUPPLIER_PAYMENT_ADMIN_VERIFICATION', role)).toBe(true);
    }
  });

  it('OPERATOR is excluded from resolving mandatory-refund disputes', () => {
    expect(isActionAllowed('DISPUTE_RESOLVE_MANDATORY_REFUND', 'ADMIN_OPERATOR')).toBe(false);
    expect(isActionAllowed('DISPUTE_RESOLVE_MANDATORY_REFUND', 'ADMIN_OWNER')).toBe(true);
    expect(isActionAllowed('DISPUTE_RESOLVE_MANDATORY_REFUND', 'ADMIN_ACCOUNTANT')).toBe(true);
    expect(requiresFourEyes('DISPUTE_RESOLVE_MANDATORY_REFUND')).toBe(true);
  });

  it('OPERATOR cannot view the actual profit margin', () => {
    expect(isActionAllowed('VIEW_ACTUAL_PROFIT_MARGIN', 'ADMIN_OPERATOR')).toBe(false);
    expect(isActionAllowed('VIEW_ACTUAL_PROFIT_MARGIN', 'ADMIN_OWNER')).toBe(true);
    expect(isActionAllowed('VIEW_ACTUAL_PROFIT_MARGIN', 'ADMIN_ACCOUNTANT')).toBe(true);
  });

  it('CUSTOMER and SUPPLIER never appear in any admin permission rule', () => {
    for (const rule of PERMISSION_MATRIX) {
      expect(rule.allowedRoles).not.toContain('CUSTOMER');
      expect(rule.allowedRoles).not.toContain('SUPPLIER');
    }
  });

  it('an unknown role is never allowed any action', () => {
    expect(isActionAllowed('ORDER_APPROVE_EDIT_REJECT', 'SYSTEM')).toBe(false);
  });

  it('only OWNER can create new admin accounts', () => {
    expect(isActionAllowed('ADMIN_ACCOUNT_MANAGE', 'ADMIN_OWNER')).toBe(true);
    expect(isActionAllowed('ADMIN_ACCOUNT_MANAGE', 'ADMIN_OPERATOR')).toBe(false);
    expect(isActionAllowed('ADMIN_ACCOUNT_MANAGE', 'ADMIN_ACCOUNTANT')).toBe(false);
  });

  it('OWNER and OPERATOR can register a new supplier account, ACCOUNTANT cannot', () => {
    expect(isActionAllowed('SUPPLIER_ACCOUNT_MANAGE', 'ADMIN_OWNER')).toBe(true);
    expect(isActionAllowed('SUPPLIER_ACCOUNT_MANAGE', 'ADMIN_OPERATOR')).toBe(true);
    expect(isActionAllowed('SUPPLIER_ACCOUNT_MANAGE', 'ADMIN_ACCOUNTANT')).toBe(false);
  });
});
