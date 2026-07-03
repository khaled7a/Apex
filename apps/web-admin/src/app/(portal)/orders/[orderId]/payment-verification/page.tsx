import { FinancialApproval, getOrderDetail } from '@/lib/orders';
import { AdminAccount, AdminProfile, getMe, listAdmins } from '@/lib/accounts';
import { ActionForm } from '@/components/ActionForm';
import { eligibleApprovers, findPendingApproval, adminNameById } from '@/lib/approver-picker';
import { escalateVerification, markVerified, proposeAdminVerification, approveAdminVerification, rejectReceipt, startVerification, verificationFailed } from '@/actions/payments';

export default async function PaymentVerificationPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const [detail, me, admins] = await Promise.all([getOrderDetail(orderId), getMe(), listAdmins()]);
  const { order } = detail;
  const latestPayment = detail.payments[detail.payments.length - 1];

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-xl font-bold">التحقق من الدفعة</h1>

      {detail.receipts.length > 0 && (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 font-semibold">الإيصالات المرفوعة</h2>
          <ul className="space-y-1 text-sm">
            {detail.receipts.map((r) => (
              <li key={r.id}>
                <a href={r.file_url} className="text-emerald-700 hover:underline" target="_blank" rel="noreferrer">عرض الإيصال</a>
                {' — '}{r.verified_at ? 'مُتحقَّق منه' : 'بانتظار التحقق'}
              </li>
            ))}
          </ul>
        </div>
      )}

      {order.current_state === 'CONTRACT_RECEIPT_UPLOADED' && (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 font-semibold">بدء التحقق</h2>
          <ActionForm action={startVerification} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="بدء التحقق" />
        </div>
      )}

      {order.current_state === 'CONTRACT_ADMIN_VERIFYING' && latestPayment && (
        <div className="space-y-4">
          <div className="rounded-lg border border-emerald-200 bg-white p-5">
            <h2 className="mb-3 font-semibold">مطابقة ناجحة</h2>
            <ActionForm action={markVerified} hidden={{ orderId, paymentId: latestPayment.id, expectedStateVersion: order.state_version }} submitLabel="تأكيد المطابقة" />
          </div>
          <div className="rounded-lg border border-red-200 bg-white p-5">
            <h2 className="mb-3 font-semibold">رفض الإيصال</h2>
            <ActionForm action={rejectReceipt} hidden={{ orderId, paymentId: latestPayment.id, expectedStateVersion: order.state_version }} submitLabel="رفض">
              <textarea name="reason" placeholder="سبب الرفض" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </ActionForm>
          </div>
        </div>
      )}

      {order.current_state === 'CONTRACT_RECEIPT_REJECTED' && (
        <div className="rounded-lg border border-amber-200 bg-white p-5">
          <h2 className="mb-3 font-semibold">تصعيد لنزاع دفع</h2>
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
      <h2 className="font-semibold text-slate-800">التحقق النهائي (four-eyes)</h2>
      {!pending && (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <h3 className="mb-3 font-semibold">رشِّح معتمِداً (OWNER أو ACCOUNTANT)</h3>
          <ActionForm action={proposeAdminVerification} hidden={{ orderId }} submitLabel="ترشيح">
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
          <h3 className="mb-3 font-semibold">اعتماد نهائي</h3>
          <ActionForm action={approveAdminVerification} hidden={{ orderId, paymentId, expectedStateVersion: order.state_version }} submitLabel="اعتماد" />
        </div>
      )}
      <div className="rounded-lg border border-red-200 bg-white p-5">
        <h3 className="mb-3 font-semibold">فشل التحقق (تصعيد لنزاع دفع)</h3>
        <ActionForm action={verificationFailed} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="تصعيد لنزاع" />
      </div>
    </div>
  );
}
