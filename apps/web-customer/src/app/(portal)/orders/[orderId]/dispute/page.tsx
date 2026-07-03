import { getOrderDetail } from '@/lib/orders';
import { orderStateLabel } from '@/lib/state-labels';

export default async function DisputeStatusPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const detail = await getOrderDetail(orderId);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">النزاع</h1>
      {detail.disputes.length === 0 ? (
        <p className="text-sm text-slate-600">لا يوجد نزاع مسجَّل على هذا الطلب.</p>
      ) : (
        <ul className="space-y-3">
          {detail.disputes.map((dispute) => (
            <li key={dispute.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <p className="font-medium">{orderStateLabel(`DISPUTE_${dispute.type}`)}</p>
              <p className="text-sm text-slate-500">
                الحالة: {dispute.status === 'OPEN' ? 'مفتوح' : 'تم الحل'} · فُتح في {new Date(dispute.opened_at).toLocaleDateString('ar-SA')}
              </p>
            </li>
          ))}
        </ul>
      )}
      <p className="text-sm text-slate-600">قرار حل النزاع من صلاحية الإدارة — سيصلك إشعار عند حدوث أي تحديث.</p>
    </div>
  );
}
