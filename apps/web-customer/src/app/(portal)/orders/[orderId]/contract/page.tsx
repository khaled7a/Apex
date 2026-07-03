import { getOrderDetail } from '@/lib/orders';
import { ActionForm } from '@/components/ActionForm';
import { signContract } from '@/actions/contracts';

export default async function ContractPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const detail = await getOrderDetail(orderId);
  const { order, paymentPlan, installments } = detail;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">العقد وخطة الدفع</h1>

      {paymentPlan && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-2 font-semibold">الدفعات ({installments.length})</h2>
          <ul className="divide-y divide-slate-100">
            {installments.map((installment) => (
              <li key={installment.id} className="flex items-center justify-between py-2 text-sm">
                <span>{installment.label}</span>
                <span className="font-medium">{installment.expected_amount_sar} ر.س</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-2 font-semibold">التوقيع الإلكتروني</h2>
        <p className="mb-3 text-sm text-slate-600">اكتب اسمك الكامل للتوقيع الإلكتروني والموافقة على شروط العقد.</p>
        <SignForm orderId={order.id} stateVersion={order.state_version} />
      </div>
    </div>
  );
}

function SignForm({ orderId, stateVersion }: { orderId: string; stateVersion: number }) {
  return (
    <ActionForm action={signContract} hidden={{ orderId, expectedStateVersion: stateVersion }} submitLabel="توقيع وموافقة">
      <input
        name="signatureRef"
        type="text"
        required
        placeholder="الاسم الكامل"
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
    </ActionForm>
  );
}
