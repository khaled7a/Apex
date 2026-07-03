import { getOrderDetail } from '@/lib/orders';
import { ActionForm } from '@/components/ActionForm';
import { supplierApprovesRenewal, supplierDeclinesRenewal } from '@/actions/renewals';

export default async function RenewalPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const detail = await getOrderDetail(orderId);
  const { order } = detail;

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-xl font-bold">تجديد الاتفاقية</h1>

      {order.current_state === 'RENEWAL_PENDING_SUPPLIER' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-emerald-200 bg-white p-4">
            <ActionForm
              action={supplierApprovesRenewal}
              hidden={{ orderId, expectedStateVersion: order.state_version }}
              submitLabel="الموافقة على التجديد"
            />
          </div>
          <div className="rounded-lg border border-red-200 bg-white p-4">
            <ActionForm
              action={supplierDeclinesRenewal}
              hidden={{ orderId, expectedStateVersion: order.state_version }}
              submitLabel="رفض التجديد"
            />
          </div>
        </div>
      ) : (
        <p className="text-sm text-slate-600">لا يوجد طلب تجديد بانتظار ردّك حالياً.</p>
      )}
    </div>
  );
}
