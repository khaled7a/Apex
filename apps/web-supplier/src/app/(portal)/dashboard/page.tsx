import Link from 'next/link';
import { listAssignedToMe, listBiddingBoard } from '@/lib/orders';
import { OrderStateBadge } from '@/components/OrderStateBadge';

export default async function DashboardPage() {
  const [board, assigned] = await Promise.all([listBiddingBoard(), listAssignedToMe()]);

  return (
    <div className="space-y-8">
      <section>
        <h1 className="mb-4 text-xl font-bold">عروض مفتوحة للمزايدة</h1>
        {board.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">لا توجد طلبات مفتوحة للمزايدة حالياً.</p>
        ) : (
          <ul className="space-y-3">
            {board.map((row) => (
              <li key={row.order_id}>
                <Link
                  href={`/bidding-board/${row.order_id}`}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 hover:border-emerald-400"
                >
                  <div>
                    <p className="font-medium">{row.serviceTypeLabel}</p>
                    <p className="text-xs text-slate-400">{new Date(row.created_at).toLocaleDateString('ar-SA')}</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">قدّم عرضاً</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-xl font-bold">طلباتي</h2>
        {assigned.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">لا توجد طلبات مسندة إليك بعد.</p>
        ) : (
          <ul className="space-y-3">
            {assigned.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/orders/${order.id}`}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 hover:border-emerald-400"
                >
                  <p className="font-mono text-xs text-slate-400">#{order.id.slice(0, 8)}</p>
                  <OrderStateBadge state={order.current_state} holdType={order.hold_type} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
