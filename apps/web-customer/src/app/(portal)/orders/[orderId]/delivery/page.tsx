import { getOrderDetail } from '@/lib/orders';
import { ActionForm } from '@/components/ActionForm';
import { signDelivery } from '@/actions/delivery';

export default async function DeliveryPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const detail = await getOrderDetail(orderId);
  const { order } = detail;

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-xl font-bold">تأكيد استلام الشحنة</h1>
      {order.current_state === 'FINAL_DELIVERY' ? (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="mb-3 text-sm text-slate-600">بتوقيعك أنت تؤكد استلام الشحنة بحالة مطابقة. إن كانت هناك مشكلة، يمكنك فتح نزاع بدلاً من التوقيع.</p>
          <ActionForm action={signDelivery} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="أؤكد الاستلام" />
        </div>
      ) : (
        <p className="text-sm text-slate-600">لم تصل الشحنة بعد لمرحلة التسليم النهائي.</p>
      )}
    </div>
  );
}
