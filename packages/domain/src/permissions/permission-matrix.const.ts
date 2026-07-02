import { ActorRole } from '../states/actor.types';

export type PermissionAction =
  | 'ORDER_APPROVE_EDIT_REJECT'
  | 'EXTERNAL_SUPPLIER_FINAL_APPROVAL'
  | 'OFFER_APPROVAL_AND_FX_RATE_ENTRY'
  | 'FX_RATE_DEVIATION_OWNER_APPROVAL'
  | 'ROUTINE_RECEIPT_VERIFICATION'
  | 'SUPPLIER_PAYMENT_ADMIN_VERIFICATION'
  | 'CUSTOMS_FEE_MANAGE'
  | 'DISPUTE_RESOLVE_ORDINARY'
  | 'DISPUTE_RESOLVE_MANDATORY_REFUND'
  | 'VIEW_ACTUAL_PROFIT_MARGIN'
  | 'RENEWAL_ADMIN_APPROVAL'
  | 'EXCEPTIONAL_OVERRIDE';

export interface PermissionRule {
  action: PermissionAction;
  allowedRoles: readonly ActorRole[];
  /** true if the action requires two distinct admins (submitter != approver). */
  requiresFourEyes: boolean;
  /**
   * Roles allowed to give the *final* approve() for a four-eyes action, when
   * narrower than allowedRoles (e.g. OPERATOR may propose but not finally
   * approve). Defaults to allowedRoles when omitted — see
   * isFinalApproverRoleAllowed(). FinancialApprovalService is the ONLY place
   * this is enforced; it must never be re-derived ad hoc in a *.service.ts.
   */
  finalApproverRoles?: readonly ActorRole[];
  /** true if the designated approver's role must differ from the submitter's role (not just a different person). */
  approverRoleMustDifferFromSubmitter?: boolean;
  note: string;
}

/**
 * Verbatim encoding of the RBAC matrix in docs/data-model.md §1 — the single
 * source of truth for both the PermissionMatrixGuard in apps/api and any
 * future admin-UI button visibility logic. No permission decision should
 * ever be duplicated ad hoc elsewhere.
 */
export const PERMISSION_MATRIX: readonly PermissionRule[] = [
  {
    action: 'ORDER_APPROVE_EDIT_REJECT',
    allowedRoles: ['ADMIN_OWNER', 'ADMIN_OPERATOR'],
    requiresFourEyes: false,
    note: 'اعتماد/تعديل/رفض الطلب — ACCOUNTANT مستبعد',
  },
  {
    action: 'EXTERNAL_SUPPLIER_FINAL_APPROVAL',
    allowedRoles: ['ADMIN_OWNER'],
    requiresFourEyes: true,
    note: 'الاعتماد النهائي للمورد الخارجي — OWNER فقط، OPERATOR يتحقق فقط دون اعتماد',
  },
  {
    action: 'OFFER_APPROVAL_AND_FX_RATE_ENTRY',
    allowedRoles: ['ADMIN_OWNER', 'ADMIN_OPERATOR'],
    requiresFourEyes: false,
    note: 'اعتماد عرض + إدخال fx_rate — انحراف كبير عن السعر المرجعي يتطلب اعتماد OWNER إضافي (انظر FX_RATE_DEVIATION_OWNER_APPROVAL)',
  },
  {
    action: 'FX_RATE_DEVIATION_OWNER_APPROVAL',
    allowedRoles: ['ADMIN_OWNER'],
    requiresFourEyes: false,
    note: 'اعتماد OWNER الإضافي المطلوب فقط عندما ينحرف fx_rate_used عن السعر المرجعي فوق الحد المسموح',
  },
  {
    action: 'ROUTINE_RECEIPT_VERIFICATION',
    allowedRoles: ['ADMIN_OWNER', 'ADMIN_OPERATOR', 'ADMIN_ACCOUNTANT'],
    requiresFourEyes: false,
    note: 'تحقق إيصال بنكي عادي',
  },
  {
    action: 'SUPPLIER_PAYMENT_ADMIN_VERIFICATION',
    allowedRoles: ['ADMIN_OWNER', 'ADMIN_OPERATOR', 'ADMIN_ACCOUNTANT'],
    requiresFourEyes: true,
    finalApproverRoles: ['ADMIN_OWNER', 'ADMIN_ACCOUNTANT'],
    note: 'التحقق مع المورد وقفل الاسترجاع — OPERATOR يبدأ فقط، ACCOUNTANT/OWNER يعتمد نهائياً',
  },
  {
    action: 'CUSTOMS_FEE_MANAGE',
    allowedRoles: ['ADMIN_OWNER', 'ADMIN_OPERATOR', 'ADMIN_ACCOUNTANT'],
    requiresFourEyes: true,
    note: 'إدخال/تحديث رسوم التخليص — OPERATOR ينشئ، ACCOUNTANT/OWNER يعتمد قبل النشر للعميل',
  },
  {
    action: 'DISPUTE_RESOLVE_ORDINARY',
    allowedRoles: ['ADMIN_OWNER'],
    requiresFourEyes: false,
    note: 'حل نزاع مالي عادي — القرار التنفيذي لـOWNER؛ ACCOUNTANT توصية غير ملزمة',
  },
  {
    action: 'DISPUTE_RESOLVE_MANDATORY_REFUND',
    allowedRoles: ['ADMIN_OWNER', 'ADMIN_ACCOUNTANT'],
    requiresFourEyes: true,
    approverRoleMustDifferFromSubmitter: true,
    note: 'حل DISPUTE_MANDATORY_REFUND — OWNER و ACCOUNTANT معاً إلزامياً (الشخصان من دورين مختلفين)',
  },
  {
    action: 'VIEW_ACTUAL_PROFIT_MARGIN',
    allowedRoles: ['ADMIN_OWNER', 'ADMIN_ACCOUNTANT'],
    requiresFourEyes: false,
    note: 'رؤية هامش الربح الفعلي / SalaryAccrual — OPERATOR مستبعد',
  },
  {
    action: 'RENEWAL_ADMIN_APPROVAL',
    allowedRoles: ['ADMIN_OWNER'],
    requiresFourEyes: false,
    note: 'الموافقة على تجديد اتفاقية (جانب الإدارة) — OWNER فقط',
  },
  {
    action: 'EXCEPTIONAL_OVERRIDE',
    allowedRoles: ['ADMIN_OWNER'],
    requiresFourEyes: false,
    note: 'استخدام صلاحية استثنائية — يُسجَّل override_used=true مع سبب إلزامي',
  },
];

export function isActionAllowed(action: PermissionAction, role: ActorRole): boolean {
  const rule = PERMISSION_MATRIX.find((r) => r.action === action);
  if (!rule) return false;
  return rule.allowedRoles.includes(role);
}

export function requiresFourEyes(action: PermissionAction): boolean {
  return PERMISSION_MATRIX.find((r) => r.action === action)?.requiresFourEyes ?? false;
}

/** The role(s) allowed to give the final approve() for a four-eyes action — narrower than allowedRoles for actions like SUPPLIER_PAYMENT_ADMIN_VERIFICATION. */
export function isFinalApproverRoleAllowed(action: PermissionAction, role: ActorRole): boolean {
  const rule = PERMISSION_MATRIX.find((r) => r.action === action);
  if (!rule) return false;
  return (rule.finalApproverRoles ?? rule.allowedRoles).includes(role);
}

export function approverRoleMustDifferFromSubmitter(action: PermissionAction): boolean {
  return PERMISSION_MATRIX.find((r) => r.action === action)?.approverRoleMustDifferFromSubmitter ?? false;
}
