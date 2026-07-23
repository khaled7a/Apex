import { ShieldCheck, FileText, CheckCircle2, XCircle, Send, UserCheck, Clock3 } from 'lucide-react';
import { FinancialApproval, getOrderDetail } from '@/lib/orders';
import { AdminAccount, AdminProfile, getMe, listAdmins } from '@/lib/accounts';
import { ActionForm } from '@/components/ActionForm';
import { PageHeader } from '@/components/PageHeader';
import { SectionCard } from '@/components/Card';
import { eligibleApprovers, findPendingApproval, adminNameById } from '@/lib/approver-picker';
import { escalateVerification, markVerified, proposeAdminVerification, approveAdminVerification, rejectReceipt, startVerification, verificationFailed } from '@/actions/payments';

export default async function PaymentVerificationPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const [detail, me, admins] = await Promise.all([getOrderDetail(orderId), getMe(), listAdmins()]);
  const { order } = detail;
  const latestPayment = detail.payments[detail.payments.length - 1];

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <PageHeader icon={ShieldCheck} title="التحقق من الدفعة" />

      {detail.receipts.length > 0 && (
        <SectionCard icon={FileText} title="الإيصالات المرفوعة">
          <ul className="space-y-1 text-sm">
            {detail.receipts.map((r) => (
              <li key={r.id}>
                <a href={r.file_url} className="text-emerald-700 hover:underline" target="_blank" rel="noreferrer">عرض الإيصال</a>
                {' — '}{r.verified_at ? 'مُتحقَّق منه' : 'بانتظار التحقق'}
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {order.current_state === 'CONTRACT_RECEIPT_UPLOADED' && (
        <SectionCard icon={ShieldCheck} title="بدء التحقق">
          <ActionForm action={startVerification} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="بدء التحقق" />
        </SectionCard>
      )}

      {order.current_state === 'CONTRACT_ADMIN_VERIFYING' && latestPayment && (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 font-semibold text-emerald-900">
              <CheckCircle2 className="h-4.5 w-4.5 text-emerald-700" strokeWidth={2} />
              مطابقة ناجحة
            </h2>
            <ActionForm action={markVerified} hidden={{ orderId, paymentId: latestPayment.id, expectedStateVersion: order.state_version }} submitLabel="تأكيد المطابقة" />
          </div>
          <div className="rounded-xl border border-red-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 font-semibold text-red-900">
              <XCircle className="h-4.5 w-4.5 text-red-600" strokeWidth={2} />
              رفض الإيصال
            </h2>
            <ActionForm action={rejectReceipt} hidden={{ orderId, paymentId: latestPayment.id, expectedStateVersion: order.state_version }} submitLabel="رفض">
              <textarea name="reason" placeholder="سبب الرفض" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </ActionForm>
          </div>
        </div>
      )}

      {order.current_state === 'CONTRACT_RECEIPT_REJECTED' && (
        <div className="rounded-xl border border-amber-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-amber-800">
            <Send className="h-4.5 w-4.5 text-amber-600" strokeWidth={2} />
            تصعيد لنزاع دفع
          </h2>
          <p className="mb-3 text-sm text-slate-600">إن لم يعد العميل رفع إيصال صحيح، يمكن تصعيد الأمر لنزاع دفع رسمي.</p>
          <ActionForm action={escalateVerification} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="تصعيد لنزاع" />
        </div>
      )}

      {order.current_state === 'PAYMENT_PENDING_ADMIN_VERIFICATION' && latestPayment && (
        <FourEyesSection orderId={orderId} order={order} paymentId={latestPayment.id} me={me} admins={admins} financialApprovals={detail.financialApprovals} />
      )}
    </div>
  );
}

function FourEyesSection({
  orderId,
  order,
  paymentId,
  me,
  admins,
  financialApprovals,
}: {
  orderId: string;
  order: { state_version: number };
  paymentId: string;
  me: AdminProfile;
  admins: AdminAccount[];
  financialApprovals: FinancialApproval[];
}) {
  const pending = findPendingApproval(financialApprovals, 'SUPPLIER_PAYMENT_ADMIN_VERIFICATION');
  const eligible = eligibleApprovers('SUPPLIER_PAYMENT_ADMIN_VERIFICATION', admins, me);

  return (
    <div className="space-y-4">
      <h2 className="flex items-center gap-2 font-semibold text-slate-800">
        <ShieldCheck className="h-4.5 w-4.5 text-emerald-700" strokeWidth={2} />
        التحقق النهائي (four-eyes)
      </h2>
      {!pending && (
        <SectionCard icon={UserCheck} title="رشِّح معتمِداً (OWNER أو ACCOUNTANT)">
          <ActionForm action={proposeAdminVerification} hidden={{ orderId }} submitLabel="ترشيح">
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
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-emerald-900">
            <CheckCircle2 className="h-4.5 w-4.5 text-emerald-700" strokeWidth={2} />
            اعتماد نهائي
          </h3>
          <ActionForm action={approveAdminVerification} hidden={{ orderId, paymentId, expectedStateVersion: order.state_version }} submitLabel="اعتماد" />
        </div>
      )}
      <div className="rounded-xl border border-red-200 bg-white p-5 shadow-sm">
        <h3 className="mb-3 flex items-center gap-2 font-semibold text-red-900">
          <XCircle className="h-4.5 w-4.5 text-red-600" strokeWidth={2} />
          فشل التحقق (تصعيد لنزاع دفع)
        </h3>
        <ActionForm action={verificationFailed} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="تصعيد لنزاع" />
      </div>
    </div>
  );
}
