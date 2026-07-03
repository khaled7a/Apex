import { getOrderDetail } from '@/lib/orders';
import { ActionForm } from '@/components/ActionForm';
import { adminApprovesRenewal, adminRejectsRenewal, pickAlternateSupplier } from '@/actions/renewals';

export default async function RenewalPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const detail = await getOrderDetail(orderId);
  const { order } = detail;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-xl font-bold">تجديد الاتفاقية</h1>

      {order.current_state === 'RENEWAL_SUPPLIER_DECLINED' && (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 font-semibold">رفض المورد التجديد — اختيار مورد بديل</h2>
          <p className="mb-3 text-sm text-slate-600">يعيد الطلب لمرحلة اختيار المورد بدل إلغاء كامل وبدء من الصفر.</p>
          <ActionForm action={pickAlternateSupplier} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="اختيار مورد بديل" />
        </div>
      )}

      {order.current_state === 'RENEWAL_PENDING_ADMIN' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-emerald-200 bg-white p-5">
            <h2 className="mb-3 font-semibold">اعتماد التجديد</h2>
            <p className="mb-3 text-xs text-slate-500">يستأنف الطلب تلقائياً عند نقطة التجمّد الأصلية.</p>
            <ActionForm action={adminApprovesRenewal} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="اعتماد" />
          </div>
          <div className="rounded-lg border border-red-200 bg-white p-5">
            <h2 className="mb-3 font-semibold">رفض التجديد</h2>
            <ActionForm action={adminRejectsRenewal} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="رفض" />
          </div>
        </div>
      )}

      {!['RENEWAL_SUPPLIER_DECLINED', 'RENEWAL_PENDING_ADMIN'].includes(order.current_state) && (
        <p className="text-sm text-slate-500">التجديد قيد التنسيق بين العميل والمورد — لا إجراء إداري مطلوب الآن.</p>
      )}
    </div>
  );
}
