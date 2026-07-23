import { Factory, CheckCircle2, XCircle, Paperclip } from 'lucide-react';
import { getOrderDetail } from '@/lib/orders';
import { ActionForm } from '@/components/ActionForm';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { approveCheckpoint, rejectCheckpoint } from '@/actions/production';

const CHECKPOINT_STATES = ['PROD_CHECKPOINT_1', 'PROD_CHECKPOINT_2'];

export default async function ProductionPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const detail = await getOrderDetail(orderId);
  const { order, productionUpdates } = detail;
  const canAct = CHECKPOINT_STATES.includes(order.current_state);

  return (
    <div className="space-y-6">
      <PageHeader icon={Factory} title="التصنيع" />

      <div className="space-y-3">
        {productionUpdates.length === 0 && <EmptyState icon={Factory} message="لا توجد تحديثات بعد." />}
        {productionUpdates.map((update) => (
          <Card key={update.id}>
            <p className="text-xs font-medium text-slate-400">{new Date(update.posted_at).toLocaleString('ar-SA')}</p>
            {update.content && <p className="mt-1 text-sm">{update.content}</p>}
            {update.file_url && (
              <a href={update.file_url} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1.5 text-sm text-emerald-700 hover:underline">
                <Paperclip className="h-3.5 w-3.5" strokeWidth={2} />
                عرض المرفق
              </a>
            )}
          </Card>
        ))}
      </div>

      {canAct && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-emerald-200 bg-white p-4 shadow-sm">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-emerald-800">
              <CheckCircle2 className="h-4 w-4" strokeWidth={2} />
              اعتماد هذه المرحلة
            </p>
            <ActionForm action={approveCheckpoint} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="اعتماد" />
          </div>
          <details className="rounded-xl border border-red-200 bg-white p-4 shadow-sm">
            <summary className="flex cursor-pointer items-center gap-1.5 text-sm font-medium text-red-700">
              <XCircle className="h-4 w-4" strokeWidth={2} />
              رفض هذه المرحلة
            </summary>
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
