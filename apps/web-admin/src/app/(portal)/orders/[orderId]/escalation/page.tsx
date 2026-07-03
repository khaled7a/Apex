import { getOrderDetail } from '@/lib/orders';
import { ActionForm } from '@/components/ActionForm';
import { customerNoResponseFinal, supplierNoResponseFinal } from '@/actions/escalation';

export default async function EscalationPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const detail = await getOrderDetail(orderId);
  const { order } = detail;
  const activeEscalation = detail.escalations.find((e) => !e.resolved_at);

  if (order.current_state !== 'ESCALATION_ESCALATED' || !activeEscalation) {
    return (
      <div className="mx-auto max-w-md">
        <h1 className="mb-4 text-xl font-bold">التصعيد</h1>
        <p className="text-sm text-slate-500">لا يوجد تصعيد بلا رد يحتاج قراراً نهائياً حالياً.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-xl font-bold">قرار نهائي للتصعيد</h1>
      <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
        الطرف المتوقَّع رده: {activeEscalation.actor === 'CUSTOMER_APPROVAL' ? 'العميل' : 'المورد'} — لم يرد رغم التذكير والتصعيد.
      </p>

      {activeEscalation.actor === 'CUSTOMER_APPROVAL' ? (
        <div className="rounded-lg border border-red-200 bg-white p-5">
          <h2 className="mb-3 font-semibold">عدم رد العميل — إلغاء الاتفاقية (يفتح مسار تجديد)</h2>
          <ActionForm action={customerNoResponseFinal} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="تنفيذ القرار" />
        </div>
      ) : (
        <div className="rounded-lg border border-red-200 bg-white p-5">
          <h2 className="mb-3 font-semibold">عدم رد المورد — فتح نزاع تأخير</h2>
          <ActionForm action={supplierNoResponseFinal} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="تنفيذ القرار" />
        </div>
      )}
    </div>
  );
}
