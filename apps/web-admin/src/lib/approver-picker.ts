import { AdminAccount, AdminProfile } from './accounts';
import { FinancialApproval } from './orders';

/**
 * The three "propose then approve" four-eyes actions (variant A — a named
 * colleague is designated in advance). Customs-fee approval is deliberately
 * NOT here: apps/api/src/customs-fees/customs-fees.service.ts implements it
 * as a single-step "any other eligible admin may approve" check against
 * fee.created_by, with no advance proposal step at all (variant B) — see
 * the dedicated customs page, which has its own simpler eligibility check.
 */
export type FourEyesAction = 'SUPPLIER_PAYMENT_ADMIN_VERIFICATION' | 'DISPUTE_RESOLVE_MANDATORY_REFUND' | 'EXTERNAL_SUPPLIER_FINAL_APPROVAL';

const FINAL_APPROVER_ROLES: Record<FourEyesAction, ReadonlyArray<AdminProfile['role']>> = {
  SUPPLIER_PAYMENT_ADMIN_VERIFICATION: ['OWNER', 'ACCOUNTANT'],
  DISPUTE_RESOLVE_MANDATORY_REFUND: ['OWNER', 'ACCOUNTANT'],
  EXTERNAL_SUPPLIER_FINAL_APPROVAL: ['OWNER'],
};

/** Only DISPUTE_RESOLVE_MANDATORY_REFUND requires the approver to hold a DIFFERENT role than the submitter, not merely be a different person — packages/domain's PERMISSION_MATRIX.approverRoleMustDifferFromSubmitter. */
const APPROVER_ROLE_MUST_DIFFER: Record<FourEyesAction, boolean> = {
  SUPPLIER_PAYMENT_ADMIN_VERIFICATION: false,
  DISPUTE_RESOLVE_MANDATORY_REFUND: true,
  EXTERNAL_SUPPLIER_FINAL_APPROVAL: false,
};

export function eligibleApprovers(action: FourEyesAction, admins: AdminAccount[], currentAdmin: AdminProfile): AdminAccount[] {
  const allowedRoles = FINAL_APPROVER_ROLES[action];
  return admins.filter(
    (a) =>
      a.is_active &&
      a.id !== currentAdmin.id &&
      allowedRoles.includes(a.role) &&
      (!APPROVER_ROLE_MUST_DIFFER[action] || a.role !== currentAdmin.role),
  );
}

export function findPendingApproval(financialApprovals: FinancialApproval[], action: FourEyesAction): FinancialApproval | undefined {
  return financialApprovals.find((fa) => fa.action === action && !fa.approved_at);
}

export function adminNameById(admins: AdminAccount[], id: string): string {
  return admins.find((a) => a.id === id)?.name ?? id;
}
