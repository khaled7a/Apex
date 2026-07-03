import { getOrderDetail, listOffersForCustomer } from '@/lib/orders';
import { ActionForm } from '@/components/ActionForm';
import { selectOffer, rejectAllOffers } from '@/actions/bidding';

export default async function OffersPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const [detail, offers] = await Promise.all([getOrderDetail(orderId), listOffersForCustomer(orderId)]);
  const stateVersion = detail.order.state_version;

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">العروض المقدَّمة</h1>
      <p className="text-sm text-slate-600">هوية الموردين مخفاة إلى حين إتمام التعاقد — قارن العروض واختر الأنسب.</p>

      <div className="grid gap-4 sm:grid-cols-2">
        {offers.map((offer) => (
          <div key={offer.id} className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="font-semibold">{offer.supplierLabel}</h2>
            <p className="text-sm text-slate-600">القيمة: {offer.fob_value_usd} $</p>
            <p className="text-sm text-slate-600">مدة التنفيذ: {offer.lead_time_days ?? '—'} يوم</p>
            {offer.terms && <p className="text-sm text-slate-600">الشروط: {offer.terms}</p>}
            <ActionForm
              action={selectOffer}
              hidden={{ orderId, offerId: offer.id, expectedStateVersion: stateVersion }}
              submitLabel="اختر هذا العرض"
            />
          </div>
        ))}
      </div>

      {offers.length === 0 && <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-slate-500">لا توجد عروض متاحة حالياً.</p>}

      <details className="rounded-lg border border-slate-200 bg-white p-4">
        <summary className="cursor-pointer text-sm font-medium text-red-700">لا يعجبني أي من العروض</summary>
        <div className="mt-3">
          <ActionForm action={rejectAllOffers} hidden={{ orderId, expectedStateVersion: stateVersion }} submitLabel="رفض كل العروض" />
        </div>
      </details>
    </div>
  );
}
