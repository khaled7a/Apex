import Link from 'next/link';
import { getOrderDetail } from '@/lib/orders';
import { OrderStateBadge } from '@/components/OrderStateBadge';
import { OrderTimeline } from '@/components/OrderTimeline';
import { getSupplierAction } from '@/lib/state-labels';

export default async function OrderHubPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const detail = await getOrderDetail(orderId);
  const { order } = detail;
  const activeEscalation = detail.escalations.find((e) => !e.resolved_at);

  const action = getSupplierAction(order.id, order.current_state, order.hold_type, activeEscalation?.actor);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-xs text-slate-400">#{order.id}</p>
          <h1 className="text-xl font-bold">تفاصيل الطلب</h1>
        </div>
        <OrderStateBadge state={order.current_state} holdType={order.hold_type} />
      </div>

      <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-5">
        <h2 className="mb-3 font-semibold text-emerald-900">ماذا الآن؟</h2>
        {action.waiting ? (
          <p className="text-sm text-emerald-800">{action.label}</p>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm text-emerald-800">{action.label}</p>
            <Link href={action.href} className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800">
              متابعة
            </Link>
          </div>
        )}
      </section>

      {order.hold_type === 'NONE' && (
        <p className="text-sm text-slate-600">
          تواجه مشكلة في هذا الطلب؟{' '}
          <Link href={`/orders/${order.id}/dispute/new`} className="font-medium text-emerald-700 hover:underline">
            افتح نزاعاً
          </Link>
        </p>
      )}

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-3 font-semibold">سجل الطلب</h2>
        <OrderTimeline entries={detail.timeline} />
      </section>
    </div>
  );
}
