import { AlertTriangle, ShieldCheck, Info } from 'lucide-react';
import { getOrderDetail } from '@/lib/orders';
import { orderStateLabel } from '@/lib/state-labels';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState } from '@/components/EmptyState';

export default async function DisputeStatusPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const detail = await getOrderDetail(orderId);

  return (
    <div className="space-y-6">
      <PageHeader icon={AlertTriangle} title="النزاع" />
      {detail.disputes.length === 0 ? (
        <EmptyState icon={ShieldCheck} message="لا يوجد نزاع مسجَّل على هذا الطلب." />
      ) : (
        <ul className="space-y-3">
          {detail.disputes.map((dispute) => (
            <li key={dispute.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="font-medium">{orderStateLabel(`DISPUTE_${dispute.type}`)}</p>
              <p className="text-sm text-slate-500">
                الحالة: {dispute.status === 'OPEN' ? 'مفتوح' : 'تم الحل'} · فُتح في {new Date(dispute.opened_at).toLocaleDateString('ar-SA')}
              </p>
            </li>
          ))}
        </ul>
      )}
      <p className="flex items-center gap-1.5 text-sm text-slate-600">
        <Info className="h-4 w-4 text-slate-400" strokeWidth={2} />
        قرار حل النزاع من صلاحية الإدارة — سيصلك إشعار عند حدوث أي تحديث.
      </p>
    </div>
  );
}
