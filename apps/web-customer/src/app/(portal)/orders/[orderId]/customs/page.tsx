import { Landmark, Receipt, UploadCloud } from 'lucide-react';
import { getOrderDetail } from '@/lib/orders';
import { ActionForm } from '@/components/ActionForm';
import { PageHeader } from '@/components/PageHeader';
import { SectionCard } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { payAndUploadProof } from '@/actions/customs';

export default async function CustomsPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const detail = await getOrderDetail(orderId);
  const { order, customsFees } = detail;
  const canPay = ['CUSTOMS_FEE_ADDED', 'CUSTOMS_CUSTOMER_PAYS'].includes(order.current_state);

  return (
    <div className="space-y-6">
      <PageHeader icon={Landmark} title="الرسوم الجمركية" />

      {customsFees.length === 0 ? (
        <EmptyState icon={Receipt} message="لا توجد رسوم مضافة بعد." />
      ) : (
        <ul className="space-y-2">
          {customsFees.map((fee) => (
            <li key={fee.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <span className="text-sm">{fee.label}</span>
              <span className="font-medium">{fee.amount_sar} ر.س</span>
            </li>
          ))}
        </ul>
      )}

      {canPay && (
        <SectionCard icon={UploadCloud} title="دفع الرسوم ورفع الإثبات">
          <ActionForm action={payAndUploadProof} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="رفع إثبات الدفع">
            <input name="file" type="file" required accept="image/*,.pdf" className="w-full text-sm" />
          </ActionForm>
        </SectionCard>
      )}
    </div>
  );
}
