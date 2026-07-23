import Link from 'next/link';
import { Gavel, Clock3, Package, ChevronLeft } from 'lucide-react';
import { listAssignedToMe, listBiddingBoard, listMyPendingOffers } from '@/lib/orders';
import { OrderStateBadge } from '@/components/OrderStateBadge';
import { orderStateLabel } from '@/lib/state-labels';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { EmptyState } from '@/components/EmptyState';
import { SectionCard } from '@/components/Card';

export default async function DashboardPage() {
  const [board, assigned, pending] = await Promise.all([listBiddingBoard(), listAssignedToMe(), listMyPendingOffers()]);

  return (
    <div className="space-y-6">
      <PageHeader icon={Package} title="لوحتي" />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={Gavel} label="عروض مفتوحة" value={board.length} color="emerald" />
        <StatCard icon={Clock3} label="عروضي المعلَّقة" value={pending.length} color="amber" />
        <StatCard icon={Package} label="طلباتي" value={assigned.length} color="slate" />
      </div>

      <SectionCard icon={Gavel} title="عروض مفتوحة للمزايدة">
        {board.length === 0 ? (
          <EmptyState icon={Gavel} message="لا توجد طلبات مفتوحة للمزايدة حالياً." />
        ) : (
          <ul className="space-y-3">
            {board.map((row) => (
              <li key={row.order_id}>
                <Link
                  href={`/bidding-board/${row.order_id}`}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                      <Gavel className="h-5 w-5" strokeWidth={2} />
                    </span>
                    <div>
                      <p className="font-medium">{row.serviceTypeLabel}</p>
                      <p className="text-xs text-slate-400">{new Date(row.created_at).toLocaleDateString('ar-SA')}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-800">قدّم عرضاً</span>
                    <ChevronLeft className="h-4 w-4 text-slate-300" strokeWidth={2} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard icon={Clock3} title="عروضي المعلَّقة">
        {pending.length === 0 ? (
          <EmptyState icon={Clock3} message="لا توجد عروض معلَّقة حالياً." />
        ) : (
          <ul className="space-y-3">
            {pending.map((row) => (
              <li
                key={row.order_id}
                className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                    <Clock3 className="h-5 w-5" strokeWidth={2} />
                  </span>
                  <div>
                    <p className="font-medium">{row.serviceTypeLabel}</p>
                    <p className="text-xs text-slate-400">
                      عرضك: {row.myOfferFobValueUsd ?? '—'} — {new Date(row.submitted_at).toLocaleDateString('ar-SA')}
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">{orderStateLabel(row.current_state)}</span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard icon={Package} title="طلباتي">
        {assigned.length === 0 ? (
          <EmptyState icon={Package} message="لا توجد طلبات مسندة إليك بعد." />
        ) : (
          <ul className="space-y-3">
            {assigned.map((order) => (
              <li key={order.id}>
                <Link
                  href={`/orders/${order.id}`}
                  className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-emerald-300 hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400">
                      <Package className="h-5 w-5" strokeWidth={2} />
                    </span>
                    <p className="font-mono text-xs text-slate-400">#{order.id.slice(0, 8)}</p>
                  </div>
                  <OrderStateBadge state={order.current_state} holdType={order.hold_type} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
