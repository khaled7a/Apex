import { getOrderDetail } from '@/lib/orders';
import { ActionForm } from '@/components/ActionForm';
import { payAndUploadProof } from '@/actions/customs';

export default async function CustomsPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const detail = await getOrderDetail(orderId);
  const { order, customsFees } = detail;
  const canPay = ['CUSTOMS_FEE_ADDED', 'CUSTOMS_CUSTOMER_PAYS'].includes(order.current_state);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">الرسوم الجمركية</h1>

      <ul className="space-y-2">
        {customsFees.map((fee) => (
          <li key={fee.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4">
            <span className="text-sm">{fee.label}</span>
            <span className="font-medium">{fee.amount_sar} ر.س</span>
          </li>
        ))}
        {customsFees.length === 0 && <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-slate-500">لا توجد رسوم مضافة بعد.</p>}
      </ul>

      {canPay && (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-2 font-semibold">دفع الرسوم ورفع الإثبات</h2>
          <ActionForm action={payAndUploadProof} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="رفع إثبات الدفع">
            <input name="file" type="file" required accept="image/*,.pdf" className="w-full text-sm" />
          </ActionForm>
        </div>
      )}
    </div>
  );
}
