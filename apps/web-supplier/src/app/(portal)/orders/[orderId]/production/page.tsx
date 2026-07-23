import { Factory, Paperclip } from 'lucide-react';
import { getOrderDetail } from '@/lib/orders';
import { ActionForm } from '@/components/ActionForm';
import { uploadDesign, uploadQc, resubmit } from '@/actions/production';
import { PageHeader } from '@/components/PageHeader';
import { Card, SectionCard } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';

const ACTION_BY_STATE: Record<string, { action: typeof uploadDesign; label: string; title: string }> = {
  PROD_DESIGN_SUBMITTED: { action: uploadDesign, label: 'رفع التصميم', title: 'ارفع التصميم' },
  PROD_CHECKPOINT_1_REJECTED: { action: resubmit, label: 'إعادة رفع التصميم', title: 'تم رفض التصميم — أعد الرفع' },
  PROD_FULL_PRODUCTION: { action: uploadQc, label: 'رفع الفحص النهائي', title: 'ارفع الفحص النهائي (QC)' },
  PROD_CHECKPOINT_2_REJECTED: { action: resubmit, label: 'إعادة رفع الفحص النهائي', title: 'تم رفض الفحص النهائي — أعد الرفع' },
};

export default async function ProductionPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const detail = await getOrderDetail(orderId);
  const { order, productionUpdates } = detail;
  const current = ACTION_BY_STATE[order.current_state];

  return (
    <div className="space-y-4">
      <PageHeader icon={Factory} title="التصنيع" />

      <SectionCard icon={Factory} title="التحديثات">
        <div className="space-y-3">
          {productionUpdates.length === 0 && <EmptyState icon={Factory} message="لا توجد تحديثات بعد." />}
          {productionUpdates.map((update) => (
            <div key={update.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs font-medium text-slate-400">{new Date(update.posted_at).toLocaleString('ar-SA')}</p>
              {update.content && <p className="mt-1 text-sm">{update.content}</p>}
              {update.file_url && (
                <a href={update.file_url} target="_blank" rel="noreferrer" className="mt-1 flex items-center gap-1.5 text-sm text-emerald-700 hover:underline">
                  <Paperclip className="h-3.5 w-3.5" strokeWidth={2} />
                  عرض المرفق
                </a>
              )}
            </div>
          ))}
        </div>
      </SectionCard>

      {current && (
        <Card>
          <h2 className="mb-3 font-semibold text-slate-900">{current.title}</h2>
          <ActionForm action={current.action} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel={current.label}>
            <div className="space-y-3">
              <textarea name="content" placeholder="وصف (اختياري إن أُرفق ملف)" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              <input name="file" type="file" accept="image/*,.pdf" className="w-full text-sm" />
            </div>
          </ActionForm>
        </Card>
      )}
    </div>
  );
}
