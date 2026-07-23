import { Clock3 } from 'lucide-react';
import { getOrderDetail } from '@/lib/orders';
import { ActionForm } from '@/components/ActionForm';
import { supplierResponds } from '@/actions/escalation';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';

export default async function EscalationPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const detail = await getOrderDetail(orderId);
  const { order } = detail;
  const activeEscalation = detail.escalations.find((e) => !e.resolved_at);

  return (
    <div className="space-y-4">
      <PageHeader icon={Clock3} title="تذكير مطلوب ردّك" />
      {order.hold_type === 'ESCALATION' && activeEscalation?.actor === 'SUPPLIER_DELIVERABLE' ? (
        <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5">
          <p className="mb-3 text-sm text-amber-800">لم يصلنا ردّك على هذه المرحلة بعد — يرجى التأكيد قبل انتهاء المهلة لتفادي تصعيد الطلب.</p>
          <ActionForm action={supplierResponds} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="أؤكد استلامي للتذكير" />
        </div>
      ) : (
        <EmptyState icon={Clock3} message="لا يوجد تصعيد نشط يخصّك على هذا الطلب حالياً." />
      )}
    </div>
  );
}
