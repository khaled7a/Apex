/**
 * Arabic labels for the order lifecycle — same OrderState union as the
 * customer/supplier portals, viewed from the admin's side.
 */
export const ORDER_STATE_LABELS_AR: Partial<Record<string, string>> = {
  DRAFT: 'مسودة',
  SUBMITTED: 'تم التقديم — بانتظار تأكيد العربون',
  REVIEW_PENDING: 'قيد المراجعة الإدارية',
  REVIEW_NEEDS_EDIT: 'يحتاج تعديل العميل',
  REVIEW_APPROVED: 'تمت الموافقة',
  REVIEW_REJECTED: 'مرفوض',
  SUPPLIER_CHOICE: 'اختيار مسار المورد',
  EXT_VETTING_DOCS: 'فحص مورد خارجي',
  EXT_VETTING_APPROVED: 'تم اعتماد المورد الخارجي',
  EXT_VETTING_REJECTED: 'تم رفض المورد الخارجي',
  REG_PUBLISHED: 'منشور للمزايدة',
  REG_BIDS_COLLECTING: 'جمع العروض',
  REG_BIDS_EXPIRED_NO_OFFERS: 'انتهت مهلة المزايدة بلا عروض',
  REG_ADMIN_REVIEW_BIDS: 'مراجعة العروض إدارياً',
  REG_SHOWN_TO_CUSTOMER: 'العروض معروضة على العميل',
  REG_CUSTOMER_SELECTS: 'تم اختيار عرض',
  REG_NO_OFFER_SELECTED: 'رفض العميل كل العروض',
  CONTRACT_PAYMENT_PLAN_CREATED: 'بانتظار إنشاء خطة الدفع',
  CONTRACT_SIGNED: 'تم توقيع العقد',
  CONTRACT_BANK_TRANSFER_DONE: 'تم إشعار التحويل البنكي',
  CONTRACT_RECEIPT_UPLOADED: 'تم رفع الإيصال',
  CONTRACT_RECEIPT_REJECTED: 'تم رفض الإيصال',
  CONTRACT_ADMIN_VERIFYING: 'التحقق الإداري من الدفعة',
  PAYMENT_PENDING_SUPPLIER_ACK: 'بانتظار تأكيد المورد استلام الدفعة',
  PAYMENT_PENDING_ADMIN_VERIFICATION: 'التحقق الإداري النهائي (four-eyes)',
  SUPPLIER_PAYMENT_CONFIRMED: 'تم تأكيد استلام الدفعة',
  IDENTITY_REVEALED: 'تم الكشف عن هوية الطرفين',
  PROD_DESIGN_SUBMITTED: 'بانتظار رفع المورد للتصميم',
  PROD_CHECKPOINT_1: 'بانتظار اعتماد العميل للتصميم',
  PROD_CHECKPOINT_1_REJECTED: 'رفض العميل التصميم',
  PROD_FULL_PRODUCTION: 'التصنيع الكامل جارٍ',
  PROD_QC_SUBMITTED: 'تم رفع الفحص النهائي',
  PROD_CHECKPOINT_2: 'بانتظار اعتماد العميل للفحص النهائي',
  PROD_CHECKPOINT_2_REJECTED: 'رفض العميل الفحص النهائي',
  ESCALATION_REMINDER: 'تذكير — بانتظار رد الطرف المعني',
  ESCALATION_ESCALATED: 'تم التصعيد لعدم الرد — قرار إداري نهائي مطلوب',
  AGREEMENT_CANCELLED_PENDING_RENEWAL: 'الاتفاقية أُلغيت — بانتظار قرار التجديد',
  RENEWAL_PENDING_SUPPLIER: 'طلب تجديد بانتظار رد المورد',
  RENEWAL_PENDING_ADMIN: 'طلب تجديد بانتظار اعتمادك',
  RENEWAL_SUPPLIER_DECLINED: 'رفض المورد التجديد',
  LOGISTICS_ONLY_SETUP: 'إعداد الشحن (خدمة الشحن والتخليص فقط)',
  LOADING_SHIPPING: 'جارِ التحميل والشحن',
  SHIPPING_DOCS: 'مستندات الشحن',
  PAYMENT_INSTALLMENTS_PENDING: 'بانتظار تأكيد الدفعات المتبقية',
  IN_TRANSIT: 'في الطريق',
  ARRIVED_PORT: 'وصلت للميناء',
  CUSTOMS_FEE_ADDED: 'أُضيفت رسوم تخليص',
  CUSTOMS_CUSTOMER_PAYS: 'بانتظار دفع العميل لرسوم التخليص',
  CUSTOMS_FEE_PROOF_UPLOADED: 'تم رفع إثبات دفع رسوم التخليص',
  CUSTOMS_FEE_VERIFIED: 'تم التحقق من رسوم التخليص',
  FINAL_DELIVERY: 'التسليم النهائي',
  CUSTOMER_SIGNED: 'تم توقيع العميل على الاستلام',
  SUPPLIER_RATED: 'تم تقييم المورد',
  COMPLETED: 'مكتمل',
  CANCELLED: 'ملغى',
  DISPUTE_PAYMENT: 'نزاع دفع مفتوح',
  DISPUTE_QUALITY: 'نزاع جودة مفتوح',
  DISPUTE_DELAY: 'نزاع تأخير مفتوح',
  DISPUTE_SHIPPING: 'نزاع شحن مفتوح',
  DISPUTE_MANDATORY_REFUND: 'نزاع استرداد إلزامي (four-eyes)',
  DISPUTE_RESOLVED: 'تم حل النزاع',
};

export function orderStateLabel(state: string): string {
  return ORDER_STATE_LABELS_AR[state] ?? state;
}

export type AdminAction = { label: string; href: string; waiting?: false } | { label: string; waiting: true };

// ---- §7: disputes (state-machine.md numbering) ----
function getDisputeAdminAction(orderId: string, state: string): AdminAction {
  if (state === 'DISPUTE_MANDATORY_REFUND') {
    return { label: 'نزاع استرداد إلزامي — يتطلب اعتماد OWNER و ACCOUNTANT معاً', href: `/orders/${orderId}/mandatory-refund` };
  }
  return { label: 'نزاع مفتوح — يتطلب قرار الإدارة', href: `/orders/${orderId}/dispute` };
}

// ---- Renewal ----
function getRenewalAdminAction(orderId: string, state: string): AdminAction {
  switch (state) {
    case 'RENEWAL_SUPPLIER_DECLINED':
      return { label: 'رفض المورد التجديد — اختر مساراً بديلاً', href: `/orders/${orderId}/renewal` };
    case 'RENEWAL_PENDING_ADMIN':
      return { label: 'طلب تجديد بانتظار اعتمادك', href: `/orders/${orderId}/renewal` };
    default:
      return { label: 'التجديد قيد التنسيق بين العميل والمورد', waiting: true };
  }
}

// ---- Escalation ----
function getEscalationAdminAction(orderId: string, state: string): AdminAction {
  if (state === 'ESCALATION_ESCALATED') {
    return { label: 'تصعيد بلا رد — قرار نهائي مطلوب', href: `/orders/${orderId}/escalation` };
  }
  return { label: 'بانتظار رد الطرف المعني على التذكير', waiting: true };
}

// ---- §2: submission through supplier choice / external vetting / bidding ----
function getReviewVettingBiddingAction(state: string, orderId: string): AdminAction | undefined {
  switch (state) {
    case 'SUBMITTED':
      return { label: 'تأكيد استلام العربون', href: `/orders/${orderId}/review` };
    case 'REVIEW_PENDING':
      return { label: 'مراجعة الطلب — اعتماد/رفض/طلب تعديل', href: `/orders/${orderId}/review` };
    case 'EXT_VETTING_DOCS':
      return { label: 'فحص المورد الخارجي بانتظار الاعتماد', href: `/orders/${orderId}/vetting` };
    case 'REG_BIDS_EXPIRED_NO_OFFERS':
      return { label: 'انتهت المزايدة بلا عروض — مدّد المهلة أو ألغِ الطلب', href: `/orders/${orderId}/bidding` };
    case 'REG_ADMIN_REVIEW_BIDS':
      return { label: 'مراجعة العروض وإدخال سعر الصرف', href: `/orders/${orderId}/bidding` };
    case 'REG_NO_OFFER_SELECTED':
      return { label: 'رفض العميل كل العروض — أعد النشر أو ألغِ الطلب', href: `/orders/${orderId}/bidding` };
    default:
      return undefined;
  }
}

// ---- §3: contract & payment verification ----
function getContractPaymentAction(state: string, orderId: string): AdminAction | undefined {
  switch (state) {
    case 'CONTRACT_PAYMENT_PLAN_CREATED':
      return { label: 'أنشئ خطة الدفع', href: `/orders/${orderId}/payment-plan` };
    case 'CONTRACT_RECEIPT_UPLOADED':
      return { label: 'إيصال جديد — ابدأ التحقق', href: `/orders/${orderId}/payment-verification` };
    case 'CONTRACT_ADMIN_VERIFYING':
      return { label: 'التحقق من الإيصال جارٍ', href: `/orders/${orderId}/payment-verification` };
    case 'CONTRACT_RECEIPT_REJECTED':
      return { label: 'تم رفض الإيصال — بانتظار إعادة الرفع أو التصعيد لنزاع', href: `/orders/${orderId}/payment-verification` };
    case 'PAYMENT_PENDING_ADMIN_VERIFICATION':
      return { label: 'التحقق النهائي من استلام الدفعة (four-eyes)', href: `/orders/${orderId}/payment-verification` };
    default:
      return undefined;
  }
}

// ---- §6: logistics & customs ----
function getLogisticsCustomsAction(state: string, orderId: string): AdminAction | undefined {
  switch (state) {
    case 'LOGISTICS_ONLY_SETUP':
    case 'LOADING_SHIPPING':
    case 'SHIPPING_DOCS':
    case 'IN_TRANSIT':
      return { label: 'متابعة إجراءات الشحن', href: `/orders/${orderId}/logistics` };
    case 'ARRIVED_PORT':
      return { label: 'بدء إجراءات التخليص الجمركي', href: `/orders/${orderId}/customs` };
    case 'CUSTOMS_FEE_ADDED':
      return { label: 'رسوم تخليص بانتظار الاعتماد للنشر', href: `/orders/${orderId}/customs` };
    case 'CUSTOMS_FEE_PROOF_UPLOADED':
      return { label: 'التحقق من إثبات دفع رسوم التخليص', href: `/orders/${orderId}/customs` };
    case 'CUSTOMS_FEE_VERIFIED':
      return { label: 'أضِف رسوماً إضافية أو تابع للتسليم النهائي', href: `/orders/${orderId}/customs` };
    default:
      return undefined;
  }
}

function getLifecycleAdminAction(orderId: string, state: string): AdminAction {
  const reviewVettingBidding = getReviewVettingBiddingAction(state, orderId);
  if (reviewVettingBidding) return reviewVettingBidding;
  const contractPayment = getContractPaymentAction(state, orderId);
  if (contractPayment) return contractPayment;
  const logisticsCustoms = getLogisticsCustomsAction(state, orderId);
  if (logisticsCustoms) return logisticsCustoms;

  if (state === 'CANCELLED') return { label: 'تم إلغاء هذا الطلب', waiting: true };
  if (state === 'COMPLETED') return { label: 'اكتمل هذا الطلب بنجاح', waiting: true };
  return { label: 'لا يتطلب إجراءً إدارياً في هذه المرحلة', waiting: true };
}

/**
 * "What does the admin do right now" — keyed on (current_state, hold_type),
 * same philosophy as the customer/supplier portals' own action maps. Split
 * into per-domain sub-functions (matching packages/domain/transitions.table.ts's
 * own §-numbered comment sections) since the admin acts across virtually
 * every phase, unlike the customer/supplier maps which only cover a handful
 * of states each.
 */
export function getAdminAction(orderId: string, state: string, holdType: string): AdminAction {
  if (holdType === 'DISPUTE') return getDisputeAdminAction(orderId, state);
  if (holdType === 'RENEWAL') return getRenewalAdminAction(orderId, state);
  if (holdType === 'ESCALATION') return getEscalationAdminAction(orderId, state);
  return getLifecycleAdminAction(orderId, state);
}
