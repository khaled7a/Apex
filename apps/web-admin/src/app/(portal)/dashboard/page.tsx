import Link from 'next/link';
import { listAll, listNeedsAdminAction, type QueueRow } from '@/lib/orders';
import { orderStateLabel } from '@/lib/state-labels';

const CATEGORY_LABELS_AR: Record<string, string> = {
  REVIEW: 'قيد المراجعة',
  VETTING: 'فحص مورد خارجي',
  BIDDING: 'المزايدة',
  PAYMENT_VERIFICATION: 'التحقق من الدفعات',
  LOGISTICS: 'اللوجستيات',
  CUSTOMS: 'الجمارك',
  DISPUTE: 'النزاعات',
  ESCALATION: 'التصعيدات',
  RENEWAL: 'التجديدات',
};

const CATEGORY_ORDER = ['REVIEW', 'VETTING', 'BIDDING', 'PAYMENT_VERIFICATION', 'LOGISTICS', 'CUSTOMS', 'DISPUTE', 'ESCALATION', 'RENEWAL'];

function groupByCategory(rows: QueueRow[]): Map<string, QueueRow[]> {
  const map = new Map<string, QueueRow[]>();
  for (const row of rows) {
    const category = row.category ?? 'أخرى';
    const bucket = map.get(category) ?? [];
    bucket.push(row);
    map.set(category, bucket);
  }
  return map;
}

export default async function DashboardPage() {
  const [needsAction, submitted] = await Promise.all([listNeedsAdminAction(), listAll({ state: 'SUBMITTED', pageSize: 50 })]);
  const grouped = groupByCategory(needsAction);
  const sortedCategories = [...grouped.keys()].sort((a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b));

  return (
    <div className="space-y-8">
      <section>
        <h1 className="mb-3 text-xl font-bold">طلبات جديدة — بانتظار تأكيد العربون</h1>
        {submitted.rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">لا توجد طلبات جديدة حالياً.</p>
        ) : (
          <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {submitted.rows.map((order) => (
              <Link key={order.id} href={`/orders/${order.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                <span className="font-mono text-xs text-slate-500">#{order.id.slice(0, 8)}</span>
                <span className="text-sm text-slate-700">{new Date(order.created_at).toLocaleString('ar-SA')}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h1 className="mb-3 text-xl font-bold">طلبات تحتاج إجراءً إدارياً</h1>
        {sortedCategories.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500">لا توجد طلبات تحتاج إجراءً الآن.</p>
        ) : (
          <div className="space-y-4">
            {sortedCategories.map((category) => (
              <div key={category}>
                <h2 className="mb-2 text-sm font-semibold text-slate-600">{CATEGORY_LABELS_AR[category] ?? category}</h2>
                <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
                  {grouped.get(category)!.map((order) => (
                    <Link key={order.id} href={`/orders/${order.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                      <span className="font-mono text-xs text-slate-500">#{order.id.slice(0, 8)}</span>
                      <span className="text-sm text-slate-700">{orderStateLabel(order.current_state)}</span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <Link href="/orders" className="text-sm font-medium text-emerald-700 hover:underline">
          بحث في كل الطلبات ←
        </Link>
      </section>
    </div>
  );
}
