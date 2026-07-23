import { RefreshCw, XCircle } from 'lucide-react';
import { getOrderDetail } from '@/lib/orders';
import { ActionForm } from '@/components/ActionForm';
import { PageHeader } from '@/components/PageHeader';
import { SectionCard } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { adminApprovesRenewal, adminRejectsRenewal, pickAlternateSupplier } from '@/actions/renewals';

export default async function RenewalPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const detail = await getOrderDetail(orderId);
  const { order } = detail;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <PageHeader icon={RefreshCw} title="تجديد الاتفاقية" />

      {order.current_state === 'RENEWAL_SUPPLIER_DECLINED' && (
        <SectionCard icon={RefreshCw} title="رفض المورد التجديد — اختيار مورد بديل">
          <p className="mb-3 text-sm text-slate-600">يعيد الطلب لمرحلة اختيار المورد بدل إلغاء كامل وبدء من الصفر.</p>
          <ActionForm action={pickAlternateSupplier} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="اختيار مورد بديل" />
        </SectionCard>
      )}

      {order.current_state === 'RENEWAL_PENDING_ADMIN' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-emerald-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 font-semibold text-emerald-900">
              <RefreshCw className="h-4.5 w-4.5 text-emerald-700" strokeWidth={2} />
              اعتماد التجديد
            </h2>
            <p className="mb-3 text-xs text-slate-500">يستأنف الطلب تلقائياً عند نقطة التجمّد الأصلية.</p>
            <ActionForm action={adminApprovesRenewal} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="اعتماد" />
          </div>
          <div className="rounded-xl border border-red-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 font-semibold text-red-900">
              <XCircle className="h-4.5 w-4.5 text-red-600" strokeWidth={2} />
              رفض التجديد
            </h2>
            <ActionForm action={adminRejectsRenewal} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="رفض" />
          </div>
        </div>
      )}

      {!['RENEWAL_SUPPLIER_DECLINED', 'RENEWAL_PENDING_ADMIN'].includes(order.current_state) && (
        <EmptyState icon={RefreshCw} message="التجديد قيد التنسيق بين العميل والمورد — لا إجراء إداري مطلوب الآن." />
      )}
    </div>
  );
}
