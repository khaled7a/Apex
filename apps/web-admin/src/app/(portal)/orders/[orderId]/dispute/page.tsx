import { AlertTriangle, ListChecks, CheckCircle2, Ban, XCircle } from 'lucide-react';
import { getOrderDetail } from '@/lib/orders';
import { ActionForm } from '@/components/ActionForm';
import { PageHeader } from '@/components/PageHeader';
import { SectionCard } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
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
      <div className="mx-auto max-w-md space-y-4">
        <PageHeader icon={AlertTriangle} title="النزاع" />
        <EmptyState icon={AlertTriangle} message="لا يوجد نزاع مفتوح على هذا الطلب حالياً." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <PageHeader icon={AlertTriangle} title={DISPUTE_TYPE_LABELS_AR[order.current_state] ?? 'النزاع'} />

      {detail.disputeClaims.length > 0 && (
        <SectionCard icon={ListChecks} title="المطالبات">
          <ul className="space-y-1 text-sm">
            {detail.disputeClaims.map((claim) => (
              <li key={claim.id}>{claim.description}</li>
            ))}
          </ul>
        </SectionCard>
      )}

      <div className="rounded-xl border border-emerald-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-emerald-900">
          <CheckCircle2 className="h-4.5 w-4.5 text-emerald-700" strokeWidth={2} />
          حل النزاع (استئناف الطلب من نقطة التجمّد)
        </h2>
        <ActionForm action={resolveOrdinaryDispute} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="حل النزاع" />
      </div>

      <div className="rounded-xl border border-amber-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-amber-800">
          <Ban className="h-4.5 w-4.5 text-amber-600" strokeWidth={2} />
          تعذّر الحل — إلغاء الطلب
        </h2>
        <ActionForm action={markUnresolved} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="إلغاء الطلب" />
      </div>

      <div className="rounded-xl border border-red-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-red-900">
          <XCircle className="h-4.5 w-4.5 text-red-600" strokeWidth={2} />
          إلغاء إداري مباشر
        </h2>
        <p className="mb-3 text-xs text-slate-500">إن كانت هناك دفعة أمانة مؤكَّدة سابقاً، سيُفتح نزاع استرداد إلزامي تلقائياً بدل الإلغاء الصامت.</p>
        <ActionForm action={adminCancelOrder} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="إلغاء الطلب" />
      </div>
    </div>
  );
}
