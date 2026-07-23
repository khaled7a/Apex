import { Gavel, Handshake, ThumbsDown, Inbox } from 'lucide-react';
import { getOrderDetail, listOffersForCustomer } from '@/lib/orders';
import { ActionForm } from '@/components/ActionForm';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';
import { selectOffer, rejectAllOffers } from '@/actions/bidding';

export default async function OffersPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const [detail, offers] = await Promise.all([getOrderDetail(orderId), listOffersForCustomer(orderId)]);
  const stateVersion = detail.order.state_version;

  return (
    <div className="space-y-6">
      <PageHeader icon={Gavel} title="العروض المقدَّمة" />
      <p className="text-sm text-slate-600">هوية الموردين مخفاة إلى حين إتمام التعاقد — قارن العروض واختر الأنسب.</p>

      {offers.length === 0 ? (
        <EmptyState icon={Inbox} message="لا توجد عروض متاحة حالياً." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {offers.map((offer) => (
            <Card key={offer.id} className="space-y-2">
              <h2 className="flex items-center gap-2 font-semibold">
                <Handshake className="h-4.5 w-4.5 text-emerald-700" strokeWidth={2} />
                {offer.supplierLabel}
              </h2>
              <p className="text-sm text-slate-600">القيمة: {offer.fob_value_usd} $</p>
              <p className="text-sm text-slate-600">مدة التنفيذ: {offer.lead_time_days ?? '—'} يوم</p>
              {offer.terms && <p className="text-sm text-slate-600">الشروط: {offer.terms}</p>}
              <ActionForm
                action={selectOffer}
                hidden={{ orderId, offerId: offer.id, expectedStateVersion: stateVersion }}
                submitLabel="اختر هذا العرض"
              />
            </Card>
          ))}
        </div>
      )}

      <details className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <summary className="flex cursor-pointer items-center gap-1.5 text-sm font-medium text-red-700">
          <ThumbsDown className="h-4 w-4" strokeWidth={2} />
          لا يعجبني أي من العروض
        </summary>
        <div className="mt-3">
          <ActionForm action={rejectAllOffers} hidden={{ orderId, expectedStateVersion: stateVersion }} submitLabel="رفض كل العروض" />
        </div>
      </details>
    </div>
  );
}
