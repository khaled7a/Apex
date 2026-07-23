import { AlertTriangle } from 'lucide-react';
import { getOrderDetail } from '@/lib/orders';
import { ActionForm } from '@/components/ActionForm';
import { openDispute } from '@/actions/disputes';
import { DISPUTE_EVENTS_AR } from '@/lib/dispute-labels';
import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/Card';

export default async function OpenDisputePage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const detail = await getOrderDetail(orderId);

  return (
    <div className="mx-auto max-w-md space-y-4">
      <PageHeader icon={AlertTriangle} title="فتح نزاع" />
      <p className="text-sm text-slate-600">اختر نوع المشكلة التي تواجهها — لن يقبل النظام فتح نزاع غير متوافق مع مرحلة الطلب الحالية.</p>
      <Card>
        <ActionForm action={openDispute} hidden={{ orderId, expectedStateVersion: detail.order.state_version }} submitLabel="فتح النزاع">
          <select name="event" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm">
            {Object.entries(DISPUTE_EVENTS_AR).map(([event, label]) => (
              <option key={event} value={event}>
                {label}
              </option>
            ))}
          </select>
        </ActionForm>
      </Card>
    </div>
  );
}
