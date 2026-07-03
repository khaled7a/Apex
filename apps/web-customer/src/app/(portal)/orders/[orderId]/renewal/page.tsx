import { getOrderDetail } from '@/lib/orders';
import { ActionForm } from '@/components/ActionForm';
import { requestRenewal, customerPrefersFullCancel } from '@/actions/renewals';

export default async function RenewalPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const detail = await getOrderDetail(orderId);
  const { order } = detail;

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-xl font-bold">تجديد الاتفاقية</h1>

      {order.current_state === 'AGREEMENT_CANCELLED_PENDING_RENEWAL' && (
        <div className="rounded-lg border border-purple-200 bg-purple-50 p-5">
          <p className="mb-3 text-sm text-purple-900">تم إلغاء الاتفاقية بسبب عدم الرد في الوقت المحدد. يمكنك طلب تجديدها مع نفس المورد.</p>
          <ActionForm action={requestRenewal} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="اطلب التجديد" />
        </div>
      )}

      {order.current_state === 'RENEWAL_SUPPLIER_DECLINED' && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-5">
          <p className="mb-3 text-sm text-red-900">رفض المورد طلب التجديد. يمكنك اختيار الإلغاء الكامل للطلب.</p>
          <ActionForm action={customerPrefersFullCancel} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="الإلغاء الكامل" />
        </div>
      )}

      {!['AGREEMENT_CANCELLED_PENDING_RENEWAL', 'RENEWAL_SUPPLIER_DECLINED'].includes(order.current_state) && (
        <p className="text-sm text-slate-600">طلب التجديد قيد المراجعة حالياً.</p>
      )}
    </div>
  );
}
