import { getOrderDetail } from '@/lib/orders';
import { ActionForm } from '@/components/ActionForm';
import { supplierResponds } from '@/actions/escalation';

export default async function EscalationPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const detail = await getOrderDetail(orderId);
  const { order } = detail;
  const activeEscalation = detail.escalations.find((e) => !e.resolved_at);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">تذكير مطلوب ردّك</h1>
      {order.hold_type === 'ESCALATION' && activeEscalation?.actor === 'SUPPLIER_DELIVERABLE' ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <p className="mb-3 text-sm text-amber-800">لم يصلنا ردّك على هذه المرحلة بعد — يرجى التأكيد قبل انتهاء المهلة لتفادي تصعيد الطلب.</p>
          <ActionForm action={supplierResponds} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="أؤكد استلامي للتذكير" />
        </div>
      ) : (
        <p className="text-sm text-slate-600">لا يوجد تصعيد نشط يخصّك على هذا الطلب حالياً.</p>
      )}
    </div>
  );
}
