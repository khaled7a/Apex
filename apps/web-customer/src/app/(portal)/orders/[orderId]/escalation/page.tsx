import { getOrderDetail } from '@/lib/orders';
import { ActionForm } from '@/components/ActionForm';
import { customerResponds } from '@/actions/escalation';

export default async function EscalationPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const detail = await getOrderDetail(orderId);
  const { order } = detail;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">تذكير مطلوب ردّك</h1>
      {order.hold_type === 'ESCALATION' ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <p className="mb-3 text-sm text-amber-800">لم يصلنا ردّك على هذه المرحلة بعد — يرجى التأكيد قبل انتهاء المهلة لتفادي تصعيد الطلب.</p>
          <ActionForm action={customerResponds} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="أؤكد استلامي للتذكير" />
        </div>
      ) : (
        <p className="text-sm text-slate-600">لا يوجد تصعيد نشط على هذا الطلب حالياً.</p>
      )}
    </div>
  );
}
