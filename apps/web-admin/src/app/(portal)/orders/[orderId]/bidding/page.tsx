import { getOrderDetail } from '@/lib/orders';
import { ActionForm } from '@/components/ActionForm';
import { approveFxDeviation, cancelBidding, extendDeadline, republish, reviewBids } from '@/actions/bidding';

export default async function BiddingPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const detail = await getOrderDetail(orderId);
  const { order } = detail;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <h1 className="text-xl font-bold">المزايدة</h1>

      {order.current_state === 'REG_BIDS_EXPIRED_NO_OFFERS' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-3 font-semibold">تمديد المهلة</h2>
            <ActionForm action={extendDeadline} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="تمديد" />
          </div>
          <div className="rounded-lg border border-red-200 bg-white p-5">
            <h2 className="mb-3 font-semibold">إلغاء الطلب</h2>
            <ActionForm action={cancelBidding} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="إلغاء" />
          </div>
        </div>
      )}

      {order.current_state === 'REG_ADMIN_REVIEW_BIDS' && (
        <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-3 font-semibold">العروض المقدَّمة</h2>
            {detail.offers.length === 0 ? (
              <p className="text-sm text-slate-500">لا توجد عروض.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {detail.offers.map((offer) => (
                  <li key={offer.id} className="flex justify-between">
                    <span>{offer.fob_value_usd} USD — {offer.lead_time_days ?? '—'} يوم</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-lg border border-emerald-200 bg-white p-5">
            <h2 className="mb-3 font-semibold">مراجعة العروض وإدخال سعر الصرف</h2>
            <ActionForm action={reviewBids} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="اعتماد ومتابعة">
              <input name="fxRateUsed" type="number" step="0.0001" placeholder="سعر الصرف المستخدَم" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              <input name="fxRateSource" placeholder="مصدر السعر" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
              <input name="fxReferenceRate" type="number" step="0.0001" placeholder="السعر المرجعي المستقل" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </ActionForm>
          </div>
        </div>
      )}

      {order.fx_rate_deviation_flag && !order.fx_rate_deviation_approved_at && (
        <div className="rounded-lg border border-amber-200 bg-white p-5">
          <h2 className="mb-3 font-semibold text-amber-800">انحراف سعر الصرف يتطلب اعتماد OWNER إضافي</h2>
          <ActionForm action={approveFxDeviation} hidden={{ orderId }} submitLabel="اعتماد الانحراف" />
        </div>
      )}

      {order.current_state === 'REG_NO_OFFER_SELECTED' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-5">
            <h2 className="mb-3 font-semibold">إعادة النشر</h2>
            <ActionForm action={republish} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="إعادة نشر" />
          </div>
          <div className="rounded-lg border border-red-200 bg-white p-5">
            <h2 className="mb-3 font-semibold">إلغاء الطلب</h2>
            <ActionForm action={cancelBidding} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="إلغاء" />
          </div>
        </div>
      )}
    </div>
  );
}
