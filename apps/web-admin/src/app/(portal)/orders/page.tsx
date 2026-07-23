import Link from 'next/link';
import { Search, ListFilter, ChevronLeft, ChevronRight } from 'lucide-react';
import { listAll } from '@/lib/orders';
import { orderStateLabel } from '@/lib/state-labels';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { Card } from '@/components/Card';
import { EmptyState } from '@/components/EmptyState';

export default async function OrdersBrowsePage({ searchParams }: { searchParams: Promise<{ state?: string; page?: string }> }) {
  const { state, page } = await searchParams;
  const result = await listAll({ state, page: page ? Number(page) : undefined, pageSize: 25 });

  return (
    <div className="space-y-4">
      <PageHeader icon={Search} title="كل الطلبات" />

      <StatCard icon={ListFilter} label="إجمالي النتائج" value={result.total} color="slate" />

      <form className="flex items-center gap-2" method="get">
        <input
          name="state"
          defaultValue={state ?? ''}
          placeholder="فلترة حسب الحالة (مثلاً REVIEW_PENDING)"
          className="w-80 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-800">
          بحث
        </button>
      </form>

      <p className="text-sm text-slate-500">
        {result.total} طلب — صفحة {result.page}
      </p>

      {result.rows.length === 0 ? (
        <EmptyState icon={Search} message="لا توجد نتائج." />
      ) : (
        <Card className="overflow-hidden">
          <div className="-m-5 divide-y divide-slate-200">
            {result.rows.map((order) => (
              <Link key={order.id} href={`/orders/${order.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                <span className="font-mono text-xs text-slate-500">#{order.id.slice(0, 8)}</span>
                <span className="text-sm text-slate-700">{orderStateLabel(order.current_state)}</span>
                <span className="text-xs text-slate-400">{new Date(order.created_at).toLocaleDateString('ar-SA')}</span>
              </Link>
            ))}
          </div>
        </Card>
      )}

      <div className="flex items-center gap-3 text-sm">
        {result.page > 1 && (
          <Link href={`/orders?state=${state ?? ''}&page=${result.page - 1}`} className="flex items-center gap-1 text-emerald-700 hover:underline">
            <ChevronLeft className="h-4 w-4" strokeWidth={2} />
            السابق
          </Link>
        )}
        {result.page * result.pageSize < result.total && (
          <Link href={`/orders?state=${state ?? ''}&page=${result.page + 1}`} className="flex items-center gap-1 text-emerald-700 hover:underline">
            التالي
            <ChevronRight className="h-4 w-4" strokeWidth={2} />
          </Link>
        )}
      </div>
    </div>
  );
}
