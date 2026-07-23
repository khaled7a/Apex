import Link from 'next/link';
import { Plus, Package, Clock3, CheckCircle2, ChevronLeft } from 'lucide-react';
import { listMyOrders } from '@/lib/orders';
import { OrderStateBadge } from '@/components/OrderStateBadge';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { EmptyState } from '@/components/EmptyState';

export default async function DashboardPage() {
  const orders = await listMyOrders();
  const needsAttention = orders.filter((o) => o.hold_type !== 'NONE').length;
  const completed = orders.filter((o) => o.current_state === 'COMPLETED').length;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Package}
        title="طلباتي"
        action={
          <Link href="/orders/new" className="flex items-center gap-1.5 rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800">
            <Plus className="h-4 w-4" strokeWidth={2.25} />
            طلب جديد
          </Link>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={Package} label="إجمالي الطلبات" value={orders.length} color="slate" />
        <StatCard icon={Clock3} label="بحاجة متابعة" value={needsAttention} color="amber" />
        <StatCard icon={CheckCircle2} label="مكتملة" value={completed} color="emerald" />
      </div>

      {orders.length === 0 ? (
        <EmptyState
          icon={Package}
          message="لا توجد طلبات بعد."
          action={
            <Link href="/orders/new" className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800">
              + إنشاء أول طلب
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/orders/${order.id}`}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400">
                    <Package className="h-5 w-5" strokeWidth={2} />
                  </span>
                  <div>
                    <p className="font-mono text-xs text-slate-400">#{order.id.slice(0, 8)}</p>
                    <p className="text-sm text-slate-600">{new Date(order.created_at).toLocaleDateString('ar-SA')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <OrderStateBadge state={order.current_state} holdType={order.hold_type} />
                  <ChevronLeft className="h-4 w-4 text-slate-300" strokeWidth={2} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
