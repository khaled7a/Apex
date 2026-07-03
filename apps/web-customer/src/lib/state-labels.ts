/**
 * Arabic labels for the order lifecycle — a subset of docs/state-machine.md's
 * full state table, covering every state a customer is likely to see. States
 * without an entry still render (falling back to the raw code) rather than
 * crashing, since packages/domain's OrderState union has ~50 values and most
 * are pure admin/supplier/system bookkeeping the customer never needs a
 * dedicated label for.
 */
export const ORDER_STATE_LABELS_AR: Partial<Record<string, string>> = {
  DRAFT: 'مسودة',
  SUBMITTED: 'تم التقديم',
  REVIEW_PENDING: 'قيد المراجعة الإدارية',
  REVIEW_NEEDS_EDIT: 'يحتاج تعديلاً',
  REVIEW_APPROVED: 'تمت الموافقة',
  REVIEW_REJECTED: 'مرفوض',
  SUPPLIER_CHOICE: 'اختيار مسار المورد',
  REG_PUBLISHED: 'منشور للموردين',
  REG_BIDS_COLLECTING: 'جمع العروض',
  REG_BIDS_EXPIRED_NO_OFFERS: 'انتهت مهلة المزايدة بلا عروض',
  REG_ADMIN_REVIEW_BIDS: 'مراجعة العروض إدارياً',
  REG_SHOWN_TO_CUSTOMER: 'العروض معروضة عليك',
  REG_CUSTOMER_SELECTS: 'تم اختيار عرض',
  REG_NO_OFFER_SELECTED: 'تم رفض كل العروض',
  CONTRACT_PAYMENT_PLAN_CREATED: 'خطة الدفع جاهزة — بانتظار التوقيع',
  CONTRACT_SIGNED: 'تم توقيع العقد',
  CONTRACT_BANK_TRANSFER_DONE: 'تم إشعار التحويل البنكي',
  CONTRACT_RECEIPT_UPLOADED: 'تم رفع الإيصال',
  CONTRACT_RECEIPT_REJECTED: 'تم رفض الإيصال',
  CONTRACT_ADMIN_VERIFYING: 'التحقق الإداري من الدفعة',
  PAYMENT_PENDING_SUPPLIER_ACK: 'بانتظار تأكيد المورد',
  PAYMENT_PENDING_ADMIN_VERIFICATION: 'التحقق الإداري النهائي',
  SUPPLIER_PAYMENT_CONFIRMED: 'تم تأكيد استلام الدفعة',
  IDENTITY_REVEALED: 'تم الكشف عن هوية المورد',
  PROD_DESIGN_SUBMITTED: 'تم رفع التصميم',
  PROD_CHECKPOINT_1: 'اعتماد التصميم (Checkpoint 1)',
  PROD_CHECKPOINT_1_REJECTED: 'تم رفض التصميم — بانتظار إعادة الرفع',
  PROD_FULL_PRODUCTION: 'التصنيع الكامل جارٍ',
  PROD_QC_SUBMITTED: 'تم رفع الفحص النهائي',
  PROD_CHECKPOINT_2: 'اعتماد الفحص النهائي (Checkpoint 2)',
  PROD_CHECKPOINT_2_REJECTED: 'تم رفض الفحص النهائي — بانتظار إعادة الرفع',
  ESCALATION_REMINDER: 'تذكير — مطلوب ردّك',
  ESCALATION_ESCALATED: 'تم التصعيد لعدم الرد',
  AGREEMENT_CANCELLED_PENDING_RENEWAL: 'الاتفاقية أُلغيت — بانتظار قرار التجديد',
  RENEWAL_PENDING_SUPPLIER: 'طلب التجديد بانتظار موافقة المورد',
  RENEWAL_PENDING_ADMIN: 'طلب التجديد بانتظار اعتماد الإدارة',
  RENEWAL_SUPPLIER_DECLINED: 'المورد رفض التجديد',
  LOGISTICS_ONLY_SETUP: 'إعداد الشحن',
  LOADING_SHIPPING: 'جارِ التحميل والشحن',
  SHIPPING_DOCS: 'مستندات الشحن',
  PAYMENT_INSTALLMENTS_PENDING: 'بانتظار تأكيد الدفعات المتبقية',
  IN_TRANSIT: 'في الطريق',
  ARRIVED_PORT: 'وصلت للميناء',
  CUSTOMS_FEE_ADDED: 'أُضيفت رسوم تخليص',
  CUSTOMS_CUSTOMER_PAYS: 'مطلوب دفع رسوم التخليص',
  CUSTOMS_FEE_PROOF_UPLOADED: 'تم رفع إثبات الدفع',
  CUSTOMS_FEE_VERIFIED: 'تم التحقق من رسوم التخليص',
  FINAL_DELIVERY: 'التسليم النهائي',
  CUSTOMER_SIGNED: 'تم التوقيع على الاستلام',
  SUPPLIER_RATED: 'تم تقييم المورد',
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

export type CustomerAction = { label: string; href: string; waiting?: false } | { label: string; waiting: true };

/**
 * "What can you do right now" — keyed on (current_state, hold_type) rather
 * than a rigid step index, since a dispute/escalation/renewal is an overlay
 * on top of whatever state the order froze at (hold_type), not a
 * replacement of it. Anything not explicitly mapped falls back to a generic
 * waiting message rather than guessing — correct, if less specific.
 */
export function getCustomerAction(orderId: string, state: string, holdType: string): CustomerAction {
  if (holdType === 'DISPUTE') {
    return { label: 'يوجد نزاع مفتوح على هذا الطلب — بانتظار قرار الإدارة', href: `/orders/${orderId}/dispute` };
  }
  if (holdType === 'RENEWAL') {
    if (state === 'AGREEMENT_CANCELLED_PENDING_RENEWAL' || state === 'RENEWAL_SUPPLIER_DECLINED') {
      return { label: 'اطلب تجديد الاتفاقية أو اختر الإلغاء الكامل', href: `/orders/${orderId}/renewal` };
    }
    return { label: 'طلب التجديد قيد المراجعة', waiting: true };
  }
  if (holdType === 'ESCALATION' && state === 'ESCALATION_REMINDER') {
    return { label: 'مطلوب ردّك قبل انتهاء المهلة', href: `/orders/${orderId}/escalation` };
  }

  switch (state) {
    case 'REVIEW_NEEDS_EDIT':
      return { label: 'الإدارة طلبت تعديل الطلب — أعد التقديم', href: `/orders/${orderId}` };
    case 'REG_SHOWN_TO_CUSTOMER':
      return { label: 'راجع العروض واختر مورداً', href: `/orders/${orderId}/offers` };
    case 'CONTRACT_PAYMENT_PLAN_CREATED':
      return { label: 'وقّع العقد الإلكتروني', href: `/orders/${orderId}/contract` };
    case 'CONTRACT_SIGNED':
      return { label: 'أرسل إشعار التحويل البنكي', href: `/orders/${orderId}/payment` };
    case 'CONTRACT_RECEIPT_REJECTED':
      return { label: 'تم رفض الإيصال — أعد رفعه', href: `/orders/${orderId}/payment` };
    case 'PROD_CHECKPOINT_1':
      return { label: 'اعتمد أو ارفض التصميم', href: `/orders/${orderId}/production` };
    case 'PROD_CHECKPOINT_2':
      return { label: 'اعتمد أو ارفض الفحص النهائي', href: `/orders/${orderId}/production` };
    case 'CUSTOMS_FEE_ADDED':
    case 'CUSTOMS_CUSTOMER_PAYS':
      return { label: 'ادفع رسوم التخليص وارفع الإثبات', href: `/orders/${orderId}/customs` };
    case 'FINAL_DELIVERY':
      return { label: 'وقّع استلام الشحنة', href: `/orders/${orderId}/delivery` };
    case 'CUSTOMER_SIGNED':
      return { label: 'قيّم المورد لإغلاق الطلب', href: `/orders/${orderId}/rating` };
    case 'CANCELLED':
      return { label: 'تم إلغاء هذا الطلب', waiting: true };
    case 'COMPLETED':
      return { label: 'اكتمل هذا الطلب بنجاح', waiting: true };
    default:
      return { label: 'الطلب قيد المعالجة من الإدارة أو المورد حالياً', waiting: true };
  }
}
