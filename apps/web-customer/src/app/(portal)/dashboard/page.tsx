import Link from 'next/link';
import { listMyOrders } from '@/lib/orders';
import { OrderStateBadge } from '@/components/OrderStateBadge';

export default async function DashboardPage() {
  const orders = await listMyOrders();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">طلباتي</h1>
        <Link href="/orders/new" className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800">
          + طلب جديد
        </Link>
      </div>

      {orders.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">لا توجد طلبات بعد.</p>
      ) : (
        <ul className="space-y-3">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/orders/${order.id}`}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 hover:border-emerald-400"
              >
                <div>
                  <p className="font-mono text-xs text-slate-400">#{order.id.slice(0, 8)}</p>
                  <p className="text-sm text-slate-600">{new Date(order.created_at).toLocaleDateString('ar-SA')}</p>
                </div>
                <OrderStateBadge state={order.current_state} holdType={order.hold_type} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
