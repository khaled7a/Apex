import { getOrderDetail } from '@/lib/orders';
import { ActionForm } from '@/components/ActionForm';
import { adminCancelOrder, markUnresolved, resolveOrdinaryDispute } from '@/actions/disputes';

const DISPUTE_TYPE_LABELS_AR: Record<string, string> = {
  DISPUTE_PAYMENT: 'نزاع دفع',
  DISPUTE_QUALITY: 'نزاع جودة',
  DISPUTE_DELAY: 'نزاع تأخير',
  DISPUTE_SHIPPING: 'نزاع شحن',
};

export default async function DisputePage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const detail = await getOrderDetail(orderId);
  const { order } = detail;
  const activeDispute = detail.disputes.find((d) => d.status === 'OPEN');

  if (order.hold_type !== 'DISPUTE' || !activeDispute) {
    return (
      <div className="mx-auto max-w-md">
        <h1 className="mb-4 text-xl font-bold">النزاع</h1>
        <p className="text-sm text-slate-500">لا يوجد نزاع مفتوح على هذا الطلب حالياً.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-xl font-bold">{DISPUTE_TYPE_LABELS_AR[order.current_state] ?? 'النزاع'}</h1>

      {detail.disputeClaims.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 font-semibold">المطالبات</h2>
          <ul className="space-y-1 text-sm">
            {detail.disputeClaims.map((claim) => (
              <li key={claim.id}>{claim.description}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-lg border border-emerald-200 bg-white p-5">
        <h2 className="mb-3 font-semibold">حل النزاع (استئناف الطلب من نقطة التجمّد)</h2>
        <ActionForm action={resolveOrdinaryDispute} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="حل النزاع" />
      </div>

      <div className="rounded-lg border border-amber-200 bg-white p-5">
        <h2 className="mb-3 font-semibold">تعذّر الحل — إلغاء الطلب</h2>
        <ActionForm action={markUnresolved} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="إلغاء الطلب" />
      </div>

      <div className="rounded-lg border border-red-200 bg-white p-5">
        <h2 className="mb-3 font-semibold">إلغاء إداري مباشر</h2>
        <p className="mb-3 text-xs text-slate-500">إن كانت هناك دفعة أمانة مؤكَّدة سابقاً، سيُفتح نزاع استرداد إلزامي تلقائياً بدل الإلغاء الصامت.</p>
        <ActionForm action={adminCancelOrder} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="إلغاء الطلب" />
      </div>
    </div>
  );
}
