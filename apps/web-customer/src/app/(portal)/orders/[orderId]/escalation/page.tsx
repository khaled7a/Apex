import { Clock3 } from 'lucide-react';
import { getOrderDetail } from '@/lib/orders';
import { ActionForm } from '@/components/ActionForm';
import { PageHeader } from '@/components/PageHeader';
import { customerResponds } from '@/actions/escalation';

export default async function EscalationPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const detail = await getOrderDetail(orderId);
  const { order } = detail;

  return (
    <div className="space-y-6">
      <PageHeader icon={Clock3} title="تذكير مطلوب ردّك" />
      {order.hold_type === 'ESCALATION' ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
          <p className="mb-3 text-sm text-amber-800">لم يصلنا ردّك على هذه المرحلة بعد — يرجى التأكيد قبل انتهاء المهلة لتفادي تصعيد الطلب.</p>
          <ActionForm action={customerResponds} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="أؤكد استلامي للتذكير" />
        </div>
      ) : (
        <p className="text-sm text-slate-600">لا يوجد تصعيد نشط على هذا الطلب حالياً.</p>
      )}
    </div>
  );
}
