import { getMe } from '@/lib/accounts';
import { getOrderDetail } from '@/lib/orders';
import { ActionForm } from '@/components/ActionForm';
import { addMoreFees, approveFee, createFee, noMoreFees, rejectProof, adminVerifiesFee, startCustoms } from '@/actions/customs';

export default async function CustomsPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const [detail, me] = await Promise.all([getOrderDetail(orderId), getMe()]);
  const { order } = detail;
  const canGiveFinalApproval = me.role === 'OWNER' || me.role === 'ACCOUNTANT';

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-xl font-bold">رسوم التخليص الجمركي</h1>

      {order.current_state === 'ARRIVED_PORT' && (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 font-semibold">بدء إجراءات التخليص</h2>
          <ActionForm action={startCustoms} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="بدء" />
        </div>
      )}

      {(order.current_state === 'CUSTOMS_FEE_ADDED' || order.current_state === 'CUSTOMS_FEE_VERIFIED') && (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 font-semibold">إضافة رسم جديد</h2>
          <ActionForm action={createFee} hidden={{ orderId }} submitLabel="إضافة">
            <input name="label" placeholder="وصف الرسم" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <input name="amountSar" type="number" step="0.01" placeholder="المبلغ (ريال)" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </ActionForm>
        </div>
      )}

      {detail.customsFees.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 font-semibold">الرسوم الحالية</h2>
          <ul className="space-y-3 text-sm">
            {detail.customsFees.map((fee) => (
              <li key={fee.id} className="flex items-center justify-between border-b border-slate-100 pb-2">
                <span>{fee.label} — {fee.amount_sar} ريال — {fee.status}</span>
                {fee.status === 'DRAFT' && (
                  canGiveFinalApproval && fee.created_by !== me.id ? (
                    <ActionForm action={approveFee} hidden={{ orderId, feeId: fee.id, expectedStateVersion: order.state_version }} submitLabel="اعتماد" />
                  ) : (
                    <span className="text-xs text-slate-400">بانتظار اعتماد مدير آخر (لا يمكنك اعتماد رسمك الخاص)</span>
                  )
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {order.current_state === 'CUSTOMS_FEE_PROOF_UPLOADED' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-emerald-200 bg-white p-5">
            <h2 className="mb-3 font-semibold">التحقق من إثبات الدفع</h2>
            <ActionForm action={adminVerifiesFee} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="تحقق" />
          </div>
          <div className="rounded-lg border border-red-200 bg-white p-5">
            <h2 className="mb-3 font-semibold">رفض الإثبات</h2>
            <ActionForm action={rejectProof} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="رفض">
              <textarea name="reason" placeholder="سبب الرفض" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </ActionForm>
          </div>
        </div>
      )}

      {order.current_state === 'CUSTOMS_FEE_VERIFIED' && (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 font-semibold">إنهاء مرحلة الجمارك</h2>
          <div className="flex gap-3">
            <ActionForm action={addMoreFees} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="إضافة رسوم أخرى" />
            <ActionForm action={noMoreFees} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="لا مزيد — متابعة للتسليم" />
          </div>
        </div>
      )}
    </div>
  );
}
