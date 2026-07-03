import { getOrderDetail } from '@/lib/orders';
import { getMe, listAdmins } from '@/lib/accounts';
import { ActionForm } from '@/components/ActionForm';
import { eligibleApprovers, findPendingApproval, adminNameById } from '@/lib/approver-picker';
import { approveVetting, createExternalSupplier, proposeVettingApproval, rejectVetting } from '@/actions/external-suppliers';

export default async function VettingPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const [detail, me, admins] = await Promise.all([getOrderDetail(orderId), getMe(), listAdmins()]);
  const { order } = detail;

  if (!detail.externalSupplier) {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <h1 className="text-xl font-bold">تسجيل مورد خارجي</h1>
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <ActionForm action={createExternalSupplier} hidden={{ orderId }} submitLabel="تسجيل">
            <input name="legalName" placeholder="الاسم القانوني" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <input name="licenseNumber" placeholder="رقم الترخيص (اختياري)" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <input name="yearsActive" type="number" placeholder="سنوات النشاط (اختياري)" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            <input name="verificationSource" placeholder="مصدر التحقق (اختياري)" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </ActionForm>
        </div>
      </div>
    );
  }

  if (order.current_state !== 'EXT_VETTING_DOCS') {
    return (
      <div className="mx-auto max-w-md">
        <h1 className="mb-4 text-xl font-bold">فحص المورد الخارجي</h1>
        <p className="text-sm text-slate-500">حالة الفحص الحالية: {detail.externalSupplier.vetting_status}. لا يوجد إجراء متاح في هذه المرحلة.</p>
      </div>
    );
  }

  const pending = findPendingApproval(detail.financialApprovals, 'EXTERNAL_SUPPLIER_FINAL_APPROVAL');
  const eligible = eligibleApprovers('EXTERNAL_SUPPLIER_FINAL_APPROVAL', admins, me);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-xl font-bold">اعتماد فحص المورد الخارجي</h1>
      <p className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">{detail.externalSupplier.legal_name}</p>

      {!pending && (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 font-semibold">رشِّح معتمِداً (OWNER آخر)</h2>
          <ActionForm action={proposeVettingApproval} hidden={{ orderId }} submitLabel="ترشيح">
            <select name="approverId" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
              <option value="">اختر...</option>
              {eligible.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </ActionForm>
        </div>
      )}

      {pending && pending.approver_id !== me.id && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">بانتظار اعتماد {adminNameById(admins, pending.approver_id)}</p>
      )}

      {pending && pending.approver_id === me.id && (
        <div className="rounded-lg border border-emerald-200 bg-white p-5">
          <h2 className="mb-3 font-semibold">اعتماد نهائي</h2>
          <ActionForm action={approveVetting} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="اعتماد" />
        </div>
      )}

      <div className="rounded-lg border border-red-200 bg-white p-5">
        <h2 className="mb-3 font-semibold">رفض المورد</h2>
        <ActionForm action={rejectVetting} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="رفض" />
      </div>
    </div>
  );
}
