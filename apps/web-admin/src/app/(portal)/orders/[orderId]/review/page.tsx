import { getOrderDetail } from '@/lib/orders';
import { ActionForm } from '@/components/ActionForm';
import { approveOrder, confirmDeposit, rejectOrder, requestEdit } from '@/actions/orders';

export default async function ReviewPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const detail = await getOrderDetail(orderId);
  const { order } = detail;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-xl font-bold">مراجعة الطلب</h1>

      {order.current_state === 'SUBMITTED' && (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="mb-3 text-sm text-slate-600">تأكد فعلياً من وصول العربون قبل المتابعة.</p>
          <ActionForm action={confirmDeposit} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="تأكيد استلام العربون" />
        </div>
      )}

      {order.current_state === 'REVIEW_PENDING' && (
        <div className="space-y-4">
          {detail.externalSupplier && (
            <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
              مورد خارجي مسجَّل: {detail.externalSupplier.legal_name} (سيحتاج فحصاً بعد الاعتماد)
            </p>
          )}
          <div className="rounded-lg border border-emerald-200 bg-white p-5">
            <h2 className="mb-3 font-semibold">اعتماد الطلب</h2>
            <ActionForm action={approveOrder} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="اعتماد">
              <label className="block text-sm text-slate-600">
                مسار المورد (اتركه فارغاً إن كانت الخدمة شحن وتخليص فقط)
                <select name="supplierType" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" defaultValue="">
                  <option value="">— بلا مورد (شحن وتخليص فقط) —</option>
                  <option value="REGISTERED">مورد مسجَّل (عبر المزايدة)</option>
                  <option value="EXTERNAL">مورد خارجي</option>
                </select>
              </label>
              {detail.externalSupplier && (
                <input type="hidden" name="externalSupplierId" value={detail.externalSupplier.id} />
              )}
              {!detail.externalSupplier && (
                <p className="text-xs text-slate-500">
                  لتسجيل مورد خارجي بديل، اذهب أولاً إلى <a href={`/orders/${orderId}/vetting`} className="text-emerald-700 hover:underline">صفحة فحص المورد الخارجي</a>.
                </p>
              )}
            </ActionForm>
          </div>

          <div className="rounded-lg border border-amber-200 bg-white p-5">
            <h2 className="mb-3 font-semibold">طلب تعديل من العميل</h2>
            <ActionForm action={requestEdit} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="طلب تعديل" />
          </div>

          <div className="rounded-lg border border-red-200 bg-white p-5">
            <h2 className="mb-3 font-semibold">رفض الطلب</h2>
            <ActionForm action={rejectOrder} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="رفض" />
          </div>
        </div>
      )}

      {!['SUBMITTED', 'REVIEW_PENDING'].includes(order.current_state) && (
        <p className="text-sm text-slate-500">لا يوجد إجراء مراجعة مطلوب في هذه المرحلة.</p>
      )}
    </div>
  );
}
