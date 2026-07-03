import { getOrderDetail } from '@/lib/orders';
import { ActionForm } from '@/components/ActionForm';
import { rateSupplier } from '@/actions/delivery';

export default async function RatingPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const detail = await getOrderDetail(orderId);
  const { order } = detail;

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-xl font-bold">تقييم المورد</h1>
      {order.current_state === 'CUSTOMER_SIGNED' ? (
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <ActionForm action={rateSupplier} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="إرسال التقييم">
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">التقييم (1-5)</label>
                <select name="score" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
              <textarea name="notes" placeholder="ملاحظات (اختياري)" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </div>
          </ActionForm>
        </div>
      ) : (
        <p className="text-sm text-slate-600">التقييم متاح بعد توقيع استلام الشحنة.</p>
      )}
    </div>
  );
}
