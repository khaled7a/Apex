import { getOrderDetail } from '@/lib/orders';
import { ActionForm } from '@/components/ActionForm';
import { DISPUTE_EVENTS_AR } from '@/lib/dispute-labels';
import { openDisputeAsAdmin } from '@/actions/disputes';

export default async function NewDisputePage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const detail = await getOrderDetail(orderId);
  const { order } = detail;

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-xl font-bold">فتح نزاع</h1>
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <ActionForm action={openDisputeAsAdmin} hidden={{ orderId, expectedStateVersion: order.state_version }} submitLabel="فتح النزاع">
          <select name="event" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
            <option value="">اختر نوع النزاع...</option>
            {Object.entries(DISPUTE_EVENTS_AR).map(([event, label]) => (
              <option key={event} value={event}>{label}</option>
            ))}
          </select>
        </ActionForm>
      </div>
    </div>
  );
}
