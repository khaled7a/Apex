import { PackageCheck, Clock3 } from 'lucide-react';
import { getOrderDetail } from '@/lib/orders';
import { ActionForm } from '@/components/ActionForm';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/Card';
import { signDelivery } from '@/actions/delivery';

export default async function DeliveryPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const detail = await getOrderDetail(orderId);
  const { order } = detail;

  return (
    <div className="mx-auto max-w-md space-y-6">
      <PageHeader icon={PackageCheck} title="تأكيد استلام الشحنة" />
      {order.current_state === 'FINAL_DELIVERY' ? (
        <Card>
          <p className="mb-3 text-sm text-slate-600">بتوقيعك أنت تؤكد استلام الشحنة بحالة مطابقة. إن كانت هناك مشكلة، يمكنك فتح نزاع بدلاً من التوقيع.</p>
          <ActionForm action={signDelivery} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="أؤكد الاستلام" />
        </Card>
      ) : (
        <p className="flex items-center gap-1.5 text-sm text-slate-600">
          <Clock3 className="h-4 w-4 text-slate-400" strokeWidth={2} />
          لم تصل الشحنة بعد لمرحلة التسليم النهائي.
        </p>
      )}
    </div>
  );
}
