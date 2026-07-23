import { Wallet } from 'lucide-react';
import { getOrderDetail } from '@/lib/orders';
import { ActionForm } from '@/components/ActionForm';
import { PageHeader } from '@/components/PageHeader';
import { SectionCard } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { createPaymentPlan } from '@/actions/contracts';

export default async function PaymentPlanPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const detail = await getOrderDetail(orderId);
  const { order } = detail;

  if (order.current_state !== 'CONTRACT_PAYMENT_PLAN_CREATED' || detail.installments.length > 0) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <PageHeader icon={Wallet} title="خطة الدفع" />
        <EmptyState
          icon={Wallet}
          message={detail.installments.length > 0 ? 'خطة الدفع منشأة بالفعل.' : 'لا يوجد إجراء متاح في هذه المرحلة.'}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <PageHeader icon={Wallet} title="إنشاء خطة الدفع" />
      <SectionCard icon={Wallet} title="التفاصيل">
        <ActionForm action={createPaymentPlan} hidden={{ orderId }} submitLabel="إنشاء الخطة">
          <fieldset className="space-y-2 rounded-md border border-slate-200 p-3">
            <legend className="px-1 text-xs text-slate-500">الدفعة الأولى</legend>
            <input name="installment1Label" placeholder="الوصف" defaultValue="الدفعة الأولى" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <input name="installment1Amount" type="number" step="0.01" placeholder="المبلغ (ريال)" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </fieldset>
          <fieldset className="space-y-2 rounded-md border border-slate-200 p-3">
            <legend className="px-1 text-xs text-slate-500">الدفعة الثانية</legend>
            <input name="installment2Label" placeholder="الوصف" defaultValue="الدفعة الثانية" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <input name="installment2Amount" type="number" step="0.01" placeholder="المبلغ (ريال)" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </fieldset>
        </ActionForm>
      </SectionCard>
    </div>
  );
}
