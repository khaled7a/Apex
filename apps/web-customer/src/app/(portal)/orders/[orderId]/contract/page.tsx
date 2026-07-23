import { FileText, Receipt, PenLine } from 'lucide-react';
import { getOrderDetail } from '@/lib/orders';
import { ActionForm } from '@/components/ActionForm';
import { PageHeader } from '@/components/PageHeader';
import { SectionCard } from '@/components/Card';
import { signContract } from '@/actions/contracts';

export default async function ContractPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const detail = await getOrderDetail(orderId);
  const { order, paymentPlan, installments } = detail;

  return (
    <div className="space-y-6">
      <PageHeader icon={FileText} title="العقد وخطة الدفع" />

      {paymentPlan && (
        <SectionCard icon={Receipt} title={`الدفعات (${installments.length})`}>
          <ul className="divide-y divide-slate-100">
            {installments.map((installment) => (
              <li key={installment.id} className="flex items-center justify-between py-2 text-sm">
                <span>{installment.label}</span>
                <span className="font-medium">{installment.expected_amount_sar} ر.س</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <SectionCard icon={PenLine} title="التوقيع الإلكتروني">
        <p className="mb-3 text-sm text-slate-600">اكتب اسمك الكامل للتوقيع الإلكتروني والموافقة على شروط العقد.</p>
        <SignForm orderId={order.id} stateVersion={order.state_version} />
      </SectionCard>
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
