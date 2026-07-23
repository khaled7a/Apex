import { notFound } from 'next/navigation';
import { Gavel } from 'lucide-react';
import { listBiddingBoard } from '@/lib/orders';
import { ActionForm } from '@/components/ActionForm';
import { submitOffer } from '@/actions/bidding';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/Card';

export default async function BiddingBoardOrderPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const board = await listBiddingBoard();
  const row = board.find((r) => r.order_id === orderId);
  if (!row) notFound();

  return (
    <div className="mx-auto max-w-md space-y-4">
      <PageHeader icon={Gavel} title="تقديم عرض" />
      <Card>
        <p className="text-sm text-slate-600">نوع الخدمة: {row.serviceTypeLabel}</p>
        <p className="text-sm text-slate-600">تاريخ النشر: {new Date(row.created_at).toLocaleDateString('ar-SA')}</p>
      </Card>

      <Card>
        <ActionForm action={submitOffer} hidden={{ orderId }} submitLabel="إرسال العرض">
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">قيمة العرض (USD)</label>
              <input name="fobValueUsd" type="number" step="0.01" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">مدة التنفيذ (أيام)</label>
              <input name="leadTimeDays" type="number" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">الشروط (اختياري)</label>
              <textarea name="terms" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
          </div>
        </ActionForm>
      </Card>
    </div>
  );
}
