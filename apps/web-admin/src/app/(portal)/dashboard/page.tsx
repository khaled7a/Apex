import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  Inbox,
  ClipboardList,
  LayoutGrid,
  ClipboardCheck,
  BadgeCheck,
  Gavel,
  ShieldCheck,
  Truck,
  Landmark,
  AlertTriangle,
  Clock3,
  RefreshCw,
  Folder,
  ArrowLeft,
} from 'lucide-react';
import { listAll, listNeedsAdminAction, type QueueRow } from '@/lib/orders';
import { orderStateLabel } from '@/lib/state-labels';
import { PageHeader } from '@/components/PageHeader';
import { StatCard } from '@/components/StatCard';
import { EmptyState } from '@/components/EmptyState';
import { Card, SectionCard } from '@/components/Card';

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

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  REVIEW: ClipboardCheck,
  VETTING: BadgeCheck,
  BIDDING: Gavel,
  PAYMENT_VERIFICATION: ShieldCheck,
  LOGISTICS: Truck,
  CUSTOMS: Landmark,
  DISPUTE: AlertTriangle,
  ESCALATION: Clock3,
  RENEWAL: RefreshCw,
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
      <PageHeader icon={LayoutGrid} title="لوحة التحكم" subtitle="نظرة عامة على الطلبات التي تحتاج متابعة" />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={Inbox} label="طلبات جديدة" value={submitted.rows.length} color="blue" />
        <StatCard icon={ClipboardList} label="بحاجة إجراء" value={needsAction.length} color="amber" />
        <StatCard icon={LayoutGrid} label="تصنيفات نشطة" value={sortedCategories.length} color="slate" />
      </div>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-xl font-bold text-slate-900">
          <Inbox className="h-5 w-5 text-emerald-700" strokeWidth={2} />
          طلبات جديدة — بانتظار تأكيد العربون
        </h2>
        {submitted.rows.length === 0 ? (
          <EmptyState icon={Inbox} message="لا توجد طلبات جديدة حالياً." />
        ) : (
          <Card className="overflow-hidden">
            <div className="-m-5 divide-y divide-slate-200">
              {submitted.rows.map((order) => (
                <Link key={order.id} href={`/orders/${order.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                  <span className="font-mono text-xs text-slate-500">#{order.id.slice(0, 8)}</span>
                  <span className="text-sm text-slate-700">{new Date(order.created_at).toLocaleString('ar-SA')}</span>
                </Link>
              ))}
            </div>
          </Card>
        )}
      </section>

      <section>
        <h2 className="mb-3 flex items-center gap-2 text-xl font-bold text-slate-900">
          <ClipboardList className="h-5 w-5 text-emerald-700" strokeWidth={2} />
          طلبات تحتاج إجراءً إدارياً
        </h2>
        {sortedCategories.length === 0 ? (
          <EmptyState icon={ClipboardList} message="لا توجد طلبات تحتاج إجراءً الآن." />
        ) : (
          <div className="space-y-4">
            {sortedCategories.map((category) => {
              const Icon = CATEGORY_ICONS[category] ?? Folder;
              return (
                <SectionCard key={category} icon={Icon} title={CATEGORY_LABELS_AR[category] ?? category} className="overflow-hidden">
                  <div className="-mx-5 -mb-5 divide-y divide-slate-200">
                    {grouped.get(category)!.map((order) => (
                      <Link key={order.id} href={`/orders/${order.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50">
                        <span className="font-mono text-xs text-slate-500">#{order.id.slice(0, 8)}</span>
                        <span className="text-sm text-slate-700">{orderStateLabel(order.current_state)}</span>
                      </Link>
                    ))}
                  </div>
                </SectionCard>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <Link href="/orders" className="flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:underline">
          بحث في كل الطلبات
          <ArrowLeft className="h-4 w-4" strokeWidth={2} />
        </Link>
      </section>
    </div>
  );
}
