import { getOrderDetail } from '@/lib/orders';
import { ActionForm } from '@/components/ActionForm';
import { notifyTransfer, uploadReceipt } from '@/actions/payments';

export default async function PaymentPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const detail = await getOrderDetail(orderId);
  const { order, installments, payments, receipts } = detail;

  const pendingPayment = payments.find((payment) => !payment.paid_at);
  const rejection = receipts.find((receipt) => receipt.rejection_reason)?.rejection_reason;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">الدفعة</h1>

      {order.current_state === 'CONTRACT_SIGNED' && (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-2 font-semibold">أرسل إشعار التحويل البنكي</h2>
          <p className="mb-3 text-sm text-slate-600">اختر الدفعة التي حوّلتها بنكياً، ثم أرسل الإشعار قبل رفع الإيصال.</p>
          <ActionForm action={notifyTransfer} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="أرسل الإشعار">
            <select name="installmentId" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              {installments.map((installment) => (
                <option key={installment.id} value={installment.id}>
                  {installment.label} — {installment.expected_amount_sar} ر.س
                </option>
              ))}
            </select>
          </ActionForm>
        </div>
      )}

      {(order.current_state === 'CONTRACT_BANK_TRANSFER_DONE' || order.current_state === 'CONTRACT_RECEIPT_REJECTED') && pendingPayment && (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-2 font-semibold">ارفع إيصال التحويل</h2>
          {rejection && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">تم رفض الإيصال السابق: {rejection}</p>}
          <ActionForm
            action={uploadReceipt}
            hidden={{ orderId, paymentId: pendingPayment.id, expectedStateVersion: order.state_version }}
            submitLabel="رفع الإيصال"
          >
            <div className="space-y-3">
              <input name="bankReferenceNo" required placeholder="الرقم المرجعي للتحويل" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              <input name="bankName" required placeholder="اسم البنك" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              <input
                name="amountClaimed"
                type="number"
                step="0.01"
                required
                placeholder="المبلغ المحوَّل"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
              <input name="transferDateClaimed" type="date" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              <input name="file" type="file" required accept="image/*,.pdf" className="w-full text-sm" />
            </div>
          </ActionForm>
        </div>
      )}

      {order.current_state === 'CONTRACT_ADMIN_VERIFYING' && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">إيصالك قيد التحقق الإداري حالياً.</p>
      )}
    </div>
  );
}
