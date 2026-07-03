import { getOrderDetail } from '@/lib/orders';
import { ActionForm } from '@/components/ActionForm';
import { acknowledgePayment } from '@/actions/payments';

export default async function PaymentAckPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const detail = await getOrderDetail(orderId);
  const { order } = detail;

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-xl font-bold">تأكيد استلام الدفعة</h1>
      {order.current_state === 'PAYMENT_PENDING_SUPPLIER_ACK' ? (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="mb-3 text-sm text-slate-600">
            بتأكيدك أنت تُقرّ باستلام الدفعة فعلياً — سيتحقق الفريق الإداري من هذا التأكيد قبل اعتماده نهائياً.
          </p>
          <ActionForm action={acknowledgePayment} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="أؤكد استلام الدفعة" />
        </div>
      ) : (
        <p className="text-sm text-slate-600">لا يوجد تأكيد دفعة مطلوب في هذه المرحلة.</p>
      )}
    </div>
  );
}
