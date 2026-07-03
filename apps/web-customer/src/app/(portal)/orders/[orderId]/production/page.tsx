import { getOrderDetail } from '@/lib/orders';
import { ActionForm } from '@/components/ActionForm';
import { approveCheckpoint, rejectCheckpoint } from '@/actions/production';

const CHECKPOINT_STATES = ['PROD_CHECKPOINT_1', 'PROD_CHECKPOINT_2'];

export default async function ProductionPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const detail = await getOrderDetail(orderId);
  const { order, productionUpdates } = detail;
  const canAct = CHECKPOINT_STATES.includes(order.current_state);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">التصنيع</h1>

      <div className="space-y-3">
        {productionUpdates.length === 0 && <p className="text-sm text-slate-500">لا توجد تحديثات بعد.</p>}
        {productionUpdates.map((update) => (
          <div key={update.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-xs font-medium text-slate-400">{new Date(update.posted_at).toLocaleString('ar-SA')}</p>
            {update.content && <p className="mt-1 text-sm">{update.content}</p>}
            {update.file_url && (
              <a href={update.file_url} target="_blank" rel="noreferrer" className="mt-1 block text-sm text-emerald-700 hover:underline">
                عرض المرفق
              </a>
            )}
          </div>
        ))}
      </div>

      {canAct && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-emerald-200 bg-white p-4">
            <ActionForm action={approveCheckpoint} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="اعتماد" />
          </div>
          <details className="rounded-lg border border-red-200 bg-white p-4">
            <summary className="cursor-pointer text-sm font-medium text-red-700">رفض هذه المرحلة</summary>
            <div className="mt-3">
              <ActionForm action={rejectCheckpoint} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="تأكيد الرفض">
                <textarea name="reason" required placeholder="سبب الرفض" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              </ActionForm>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
