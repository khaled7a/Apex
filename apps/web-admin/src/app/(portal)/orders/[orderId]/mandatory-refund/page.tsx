import { Undo2, UserCheck, Clock3, ShieldCheck } from 'lucide-react';
import { getMe, listAdmins } from '@/lib/accounts';
import { getOrderDetail } from '@/lib/orders';
import { ActionForm } from '@/components/ActionForm';
import { PageHeader } from '@/components/PageHeader';
import { SectionCard } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { eligibleApprovers, findPendingApproval, adminNameById } from '@/lib/approver-picker';
import { approveMandatoryRefund, proposeMandatoryRefund } from '@/actions/disputes';

export default async function MandatoryRefundPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const [detail, me, admins] = await Promise.all([getOrderDetail(orderId), getMe(), listAdmins()]);
  const { order } = detail;

  if (order.current_state !== 'DISPUTE_MANDATORY_REFUND') {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <PageHeader icon={Undo2} title="نزاع الاسترداد الإلزامي" />
        <EmptyState icon={Undo2} message="لا يوجد نزاع استرداد إلزامي مفتوح على هذا الطلب." />
      </div>
    );
  }

  const pending = findPendingApproval(detail.financialApprovals, 'DISPUTE_RESOLVE_MANDATORY_REFUND');
  const eligible = eligibleApprovers('DISPUTE_RESOLVE_MANDATORY_REFUND', admins, me);
  const latestPayment = detail.payments[detail.payments.length - 1];

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <PageHeader icon={Undo2} title="نزاع استرداد إلزامي" />
      <p className="flex items-center gap-1.5 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
        <ShieldCheck className="h-4 w-4 shrink-0 text-amber-600" strokeWidth={2} />
        يتطلب هذا القرار اعتماد OWNER و ACCOUNTANT معاً — الشخصان من دورين مختلفين إلزامياً.
      </p>

      {!pending && (
        <SectionCard icon={UserCheck} title="رشِّح معتمِداً (يجب أن يحمل دوراً مختلفاً عنك)">
          <ActionForm action={proposeMandatoryRefund} hidden={{ orderId }} submitLabel="ترشيح">
            <select name="approverId" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="">اختر...</option>
              {eligible.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </ActionForm>
        </SectionCard>
      )}

      {pending && pending.approver_id !== me.id && (
        <p className="flex items-center gap-1.5 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          <Clock3 className="h-4 w-4 shrink-0 text-amber-600" strokeWidth={2} />
          بانتظار اعتماد {adminNameById(admins, pending.approver_id)}
        </p>
      )}

      {pending && pending.approver_id === me.id && latestPayment && (
        <div className="rounded-xl border border-emerald-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-emerald-900">
            <ShieldCheck className="h-4.5 w-4.5 text-emerald-700" strokeWidth={2} />
            قرار الاسترداد النهائي
          </h2>
          <ActionForm action={approveMandatoryRefund} hidden={{ orderId, paymentId: latestPayment.id, expectedStateVersion: order.state_version }} submitLabel="اعتماد القرار">
            <input name="refundedAmountSar" type="number" step="0.01" placeholder="المبلغ المسترَد (ريال)" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <input name="refundRatio" type="number" step="0.01" min="0" max="1" placeholder="نسبة الاسترداد (0 إلى 1)" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <textarea name="reason" placeholder="سبب القرار" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </ActionForm>
        </div>
      )}
    </div>
  );
}
