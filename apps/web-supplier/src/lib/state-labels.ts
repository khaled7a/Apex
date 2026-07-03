/**
 * Arabic labels for the order lifecycle — mirrors apps/web-customer's
 * dictionary (same OrderState union, just viewed from the supplier's side).
 */
export const ORDER_STATE_LABELS_AR: Partial<Record<string, string>> = {
  DRAFT: 'مسودة',
  SUBMITTED: 'تم التقديم',
  REVIEW_PENDING: 'قيد المراجعة الإدارية',
  REVIEW_NEEDS_EDIT: 'يحتاج تعديلاً',
  REVIEW_APPROVED: 'تمت الموافقة',
  REVIEW_REJECTED: 'مرفوض',
  SUPPLIER_CHOICE: 'اختيار مسار المورد',
  REG_PUBLISHED: 'منشور للمزايدة',
  REG_BIDS_COLLECTING: 'جمع العروض',
  REG_BIDS_EXPIRED_NO_OFFERS: 'انتهت مهلة المزايدة بلا عروض',
  REG_ADMIN_REVIEW_BIDS: 'مراجعة العروض إدارياً',
  REG_SHOWN_TO_CUSTOMER: 'العروض معروضة على العميل',
  REG_CUSTOMER_SELECTS: 'تم اختيار عرض',
  REG_NO_OFFER_SELECTED: 'تم رفض كل العروض',
  CONTRACT_PAYMENT_PLAN_CREATED: 'خطة الدفع جاهزة',
  CONTRACT_SIGNED: 'تم توقيع العقد',
  CONTRACT_BANK_TRANSFER_DONE: 'تم إشعار التحويل البنكي',
  CONTRACT_RECEIPT_UPLOADED: 'تم رفع الإيصال',
  CONTRACT_RECEIPT_REJECTED: 'تم رفض الإيصال',
  CONTRACT_ADMIN_VERIFYING: 'التحقق الإداري من الدفعة',
  PAYMENT_PENDING_SUPPLIER_ACK: 'بانتظار تأكيدك استلام الدفعة',
  PAYMENT_PENDING_ADMIN_VERIFICATION: 'التحقق الإداري النهائي',
  SUPPLIER_PAYMENT_CONFIRMED: 'تم تأكيد استلام الدفعة',
  IDENTITY_REVEALED: 'تم الكشف عن هوية الطرفين',
  PROD_DESIGN_SUBMITTED: 'مطلوب رفع التصميم',
  PROD_CHECKPOINT_1: 'بانتظار اعتماد العميل للتصميم',
  PROD_CHECKPOINT_1_REJECTED: 'تم رفض التصميم — مطلوب إعادة الرفع',
  PROD_FULL_PRODUCTION: 'التصنيع الكامل جارٍ',
  PROD_QC_SUBMITTED: 'تم رفع الفحص النهائي',
  PROD_CHECKPOINT_2: 'بانتظار اعتماد العميل للفحص النهائي',
  PROD_CHECKPOINT_2_REJECTED: 'تم رفض الفحص النهائي — مطلوب إعادة الرفع',
  ESCALATION_REMINDER: 'تذكير — مطلوب ردّك',
  ESCALATION_ESCALATED: 'تم التصعيد لعدم الرد',
  AGREEMENT_CANCELLED_PENDING_RENEWAL: 'الاتفاقية أُلغيت — بانتظار قرار التجديد',
  RENEWAL_PENDING_SUPPLIER: 'مطلوب ردّك على طلب التجديد',
  RENEWAL_PENDING_ADMIN: 'طلب التجديد بانتظار اعتماد الإدارة',
  RENEWAL_SUPPLIER_DECLINED: 'رفضت التجديد',
  LOGISTICS_ONLY_SETUP: 'إعداد الشحن',
  LOADING_SHIPPING: 'جارِ التحميل والشحن',
  SHIPPING_DOCS: 'مستندات الشحن',
  PAYMENT_INSTALLMENTS_PENDING: 'بانتظار تأكيد الدفعات المتبقية',
  IN_TRANSIT: 'في الطريق',
  ARRIVED_PORT: 'وصلت للميناء',
  CUSTOMS_FEE_ADDED: 'أُضيفت رسوم تخليص',
  CUSTOMS_CUSTOMER_PAYS: 'بانتظار دفع رسوم التخليص',
  CUSTOMS_FEE_PROOF_UPLOADED: 'تم رفع إثبات الدفع',
  CUSTOMS_FEE_VERIFIED: 'تم التحقق من رسوم التخليص',
  FINAL_DELIVERY: 'التسليم النهائي',
  CUSTOMER_SIGNED: 'تم التوقيع على الاستلام',
  SUPPLIER_RATED: 'تم تقييمك',
  COMPLETED: 'مكتمل',
  CANCELLED: 'ملغى',
  DISPUTE_PAYMENT: 'نزاع دفع مفتوح',
  DISPUTE_QUALITY: 'نزاع جودة مفتوح',
  DISPUTE_DELAY: 'نزاع تأخير مفتوح',
  DISPUTE_SHIPPING: 'نزاع شحن مفتوح',
  DISPUTE_MANDATORY_REFUND: 'نزاع استرداد إلزامي',
  DISPUTE_RESOLVED: 'تم حل النزاع',
};

export function orderStateLabel(state: string): string {
  return ORDER_STATE_LABELS_AR[state] ?? state;
}

export type SupplierAction = { label: string; href: string; waiting?: false } | { label: string; waiting: true };

/**
 * "What can you do right now" from the supplier's side — keyed on
 * (current_state, hold_type), same philosophy as the customer portal's
 * getCustomerAction. Escalation additionally checks which party the open
 * escalation actually targets (escalation.actor) since ESCALATION_REMINDER
 * is shared with the customer-targeted case.
 */
export function getSupplierAction(orderId: string, state: string, holdType: string, escalationActor?: string): SupplierAction {
  if (holdType === 'DISPUTE') {
    return { label: 'يوجد نزاع مفتوح على هذا الطلب — بانتظار قرار الإدارة', href: `/orders/${orderId}/dispute` };
  }
  if (holdType === 'RENEWAL') {
    if (state === 'RENEWAL_PENDING_SUPPLIER') {
      return { label: 'مطلوب ردّك على طلب تجديد الاتفاقية', href: `/orders/${orderId}/renewal` };
    }
    return { label: 'قرار التجديد قيد المراجعة', waiting: true };
  }
  if (holdType === 'ESCALATION' && state === 'ESCALATION_REMINDER') {
    if (escalationActor === 'SUPPLIER_DELIVERABLE') {
      return { label: 'مطلوب ردّك قبل انتهاء المهلة', href: `/orders/${orderId}/escalation` };
    }
    return { label: 'ننتظر رد العميل على هذه المرحلة', waiting: true };
  }

  switch (state) {
    case 'PAYMENT_PENDING_SUPPLIER_ACK':
      return { label: 'أكِّد استلام الدفعة', href: `/orders/${orderId}/payment-ack` };
    case 'PROD_DESIGN_SUBMITTED':
      return { label: 'ارفع التصميم', href: `/orders/${orderId}/production` };
    case 'PROD_CHECKPOINT_1_REJECTED':
      return { label: 'تم رفض التصميم — أعد الرفع', href: `/orders/${orderId}/production` };
    case 'PROD_FULL_PRODUCTION':
      return { label: 'ارفع الفحص النهائي (QC) عند اكتمال التصنيع', href: `/orders/${orderId}/production` };
    case 'PROD_CHECKPOINT_2_REJECTED':
      return { label: 'تم رفض الفحص النهائي — أعد الرفع', href: `/orders/${orderId}/production` };
    case 'CANCELLED':
      return { label: 'تم إلغاء هذا الطلب', waiting: true };
    case 'COMPLETED':
      return { label: 'اكتمل هذا الطلب بنجاح', waiting: true };
    default:
      return { label: 'الطلب قيد المعالجة من الإدارة أو العميل حالياً', waiting: true };
  }
}
