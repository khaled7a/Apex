import { BadgeCheck, UserCheck, CheckCircle2, XCircle, Clock3 } from 'lucide-react';
import { getOrderDetail } from '@/lib/orders';
import { getMe, listAdmins } from '@/lib/accounts';
import { ActionForm } from '@/components/ActionForm';
import { PageHeader } from '@/components/PageHeader';
import { SectionCard } from '@/components/Card';
import { eligibleApprovers, findPendingApproval, adminNameById } from '@/lib/approver-picker';
import { approveVetting, createExternalSupplier, proposeVettingApproval, rejectVetting } from '@/actions/external-suppliers';

export default async function VettingPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const [detail, me, admins] = await Promise.all([getOrderDetail(orderId), getMe(), listAdmins()]);
  const { order } = detail;

  if (!detail.externalSupplier) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <PageHeader icon={BadgeCheck} title="تسجيل مورد خارجي" />
        <SectionCard icon={BadgeCheck} title="بيانات المورد">
          <ActionForm action={createExternalSupplier} hidden={{ orderId }} submitLabel="تسجيل">
            <input name="legalName" placeholder="الاسم القانوني" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <input name="licenseNumber" placeholder="رقم الترخيص (اختياري)" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <input name="yearsActive" type="number" placeholder="سنوات النشاط (اختياري)" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <input name="verificationSource" placeholder="مصدر التحقق (اختياري)" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </ActionForm>
        </SectionCard>
      </div>
    );
  }

  if (order.current_state !== 'EXT_VETTING_DOCS') {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <PageHeader icon={BadgeCheck} title="فحص المورد الخارجي" />
        <p className="text-sm text-slate-500">حالة الفحص الحالية: {detail.externalSupplier.vetting_status}. لا يوجد إجراء متاح في هذه المرحلة.</p>
      </div>
    );
  }

  const pending = findPendingApproval(detail.financialApprovals, 'EXTERNAL_SUPPLIER_FINAL_APPROVAL');
  const eligible = eligibleApprovers('EXTERNAL_SUPPLIER_FINAL_APPROVAL', admins, me);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <PageHeader icon={BadgeCheck} title="اعتماد فحص المورد الخارجي" />
      <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">{detail.externalSupplier.legal_name}</p>

      {!pending && (
        <SectionCard icon={UserCheck} title="رشِّح معتمِداً (OWNER آخر)">
          <ActionForm action={proposeVettingApproval} hidden={{ orderId }} submitLabel="ترشيح">
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

      {pending && pending.approver_id === me.id && (
        <div className="rounded-xl border border-emerald-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-emerald-900">
            <CheckCircle2 className="h-4.5 w-4.5 text-emerald-700" strokeWidth={2} />
            اعتماد نهائي
          </h2>
          <ActionForm action={approveVetting} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="اعتماد" />
        </div>
      )}

      <div className="rounded-xl border border-red-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-red-900">
          <XCircle className="h-4.5 w-4.5 text-red-600" strokeWidth={2} />
          رفض المورد
        </h2>
        <ActionForm action={rejectVetting} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="رفض" />
      </div>
    </div>
  );
}
