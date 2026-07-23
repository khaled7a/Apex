import { RefreshCw, CheckCircle2, XCircle } from 'lucide-react';
import { getOrderDetail } from '@/lib/orders';
import { ActionForm } from '@/components/ActionForm';
import { supplierApprovesRenewal, supplierDeclinesRenewal } from '@/actions/renewals';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';

export default async function RenewalPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const detail = await getOrderDetail(orderId);
  const { order } = detail;

  return (
    <div className="mx-auto max-w-md space-y-4">
      <PageHeader icon={RefreshCw} title="تجديد الاتفاقية" />

      {order.current_state === 'RENEWAL_PENDING_SUPPLIER' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm">
            <p className="mb-3 flex items-center gap-1.5 text-sm font-medium text-emerald-800">
              <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
              الموافقة
            </p>
            <ActionForm
              action={supplierApprovesRenewal}
              hidden={{ orderId, expectedStateVersion: order.state_version }}
              submitLabel="الموافقة على التجديد"
            />
          </div>
          <div className="rounded-xl border border-red-200 bg-white p-4 shadow-sm">
            <p className="mb-3 flex items-center gap-1.5 text-sm font-medium text-red-800">
              <XCircle className="h-4 w-4" strokeWidth={2} />
              الرفض
            </p>
            <ActionForm
              action={supplierDeclinesRenewal}
              hidden={{ orderId, expectedStateVersion: order.state_version }}
              submitLabel="رفض التجديد"
            />
          </div>
        </div>
      ) : (
        <EmptyState icon={RefreshCw} message="لا يوجد طلب تجديد بانتظار ردّك حالياً." />
      )}
    </div>
  );
}
