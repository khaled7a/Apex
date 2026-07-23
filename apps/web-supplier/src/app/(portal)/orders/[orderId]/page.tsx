import Link from 'next/link';
import { AlertCircle, Package, History, Sparkles } from 'lucide-react';
import { getOrderDetail } from '@/lib/orders';
import { OrderStateBadge } from '@/components/OrderStateBadge';
import { OrderTimeline } from '@/components/OrderTimeline';
import { SectionCard } from '@/components/Card';
import { getSupplierAction } from '@/lib/state-labels';

export default async function OrderHubPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const detail = await getOrderDetail(orderId);
  const { order } = detail;
  const activeEscalation = detail.escalations.find((e) => !e.resolved_at);

  const action = getSupplierAction(order.id, order.current_state, order.hold_type, activeEscalation?.actor);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <Package className="h-5.5 w-5.5" strokeWidth={2} />
          </span>
          <div>
            <p className="font-mono text-xs text-slate-400">#{order.id}</p>
            <h1 className="text-lg font-bold text-slate-900">تفاصيل الطلب</h1>
          </div>
        </div>
        <OrderStateBadge state={order.current_state} holdType={order.hold_type} />
      </div>

      <section className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5">
        <h2 className="mb-3 flex items-center gap-2 font-semibold text-emerald-900">
          <Sparkles className="h-4.5 w-4.5" strokeWidth={2} />
          ماذا الآن؟
        </h2>
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
        <p className="flex items-center gap-1.5 text-sm text-slate-600">
          <AlertCircle className="h-4 w-4 text-slate-400" strokeWidth={2} />
          تواجه مشكلة في هذا الطلب؟{' '}
          <Link href={`/orders/${order.id}/dispute/new`} className="font-medium text-emerald-700 hover:underline">
            افتح نزاعاً
          </Link>
        </p>
      )}

      <SectionCard icon={History} title="سجل الطلب">
        <OrderTimeline entries={detail.timeline} />
      </SectionCard>
    </div>
  );
}
