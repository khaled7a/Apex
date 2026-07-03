import Link from 'next/link';
import { listAll } from '@/lib/orders';
import { orderStateLabel } from '@/lib/state-labels';

export default async function OrdersBrowsePage({ searchParams }: { searchParams: Promise<{ state?: string; page?: string }> }) {
  const { state, page } = await searchParams;
  const result = await listAll({ state, page: page ? Number(page) : undefined, pageSize: 25 });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">كل الطلبات</h1>
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

      <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {result.rows.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">لا توجد نتائج.</p>
        ) : (
          result.rows.map((order) => (
            <Link key={order.id} href={`/orders/${order.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
              <span className="font-mono text-xs text-slate-500">#{order.id.slice(0, 8)}</span>
              <span className="text-sm text-slate-700">{orderStateLabel(order.current_state)}</span>
              <span className="text-xs text-slate-400">{new Date(order.created_at).toLocaleDateString('ar-SA')}</span>
            </Link>
          ))
        )}
      </div>

      <div className="flex items-center gap-3 text-sm">
        {result.page > 1 && (
          <Link href={`/orders?state=${state ?? ''}&page=${result.page - 1}`} className="text-emerald-700 hover:underline">
            ← السابق
          </Link>
        )}
        {result.page * result.pageSize < result.total && (
          <Link href={`/orders?state=${state ?? ''}&page=${result.page + 1}`} className="text-emerald-700 hover:underline">
            التالي →
          </Link>
        )}
      </div>
    </div>
  );
}
