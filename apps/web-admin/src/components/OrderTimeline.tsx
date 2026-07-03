import { orderStateLabel } from '@/lib/state-labels';

interface TimelineEntry {
  id: string;
  from_state: string | null;
  to_state: string;
  event: string;
  acted_by_role: string;
  entered_at: string;
}

const ROLE_LABELS_AR: Record<string, string> = {
  CUSTOMER: 'العميل',
  SUPPLIER: 'المورد',
  SYSTEM: 'النظام',
  ADMIN_OWNER: 'المالك',
  ADMIN_OPERATOR: 'المشغّل',
  ADMIN_ACCOUNTANT: 'المحاسب',
};

export function OrderTimeline({ entries }: { entries: TimelineEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-slate-500">لا يوجد سجل بعد.</p>;
  }

  return (
    <ol className="space-y-3 border-e-2 border-slate-200 pe-4">
      {entries.map((entry) => (
        <li key={entry.id} className="relative">
          <span className="absolute -end-[1.4rem] top-1.5 h-2.5 w-2.5 rounded-full bg-emerald-600" />
          <p className="text-sm font-medium text-slate-900">{orderStateLabel(entry.to_state)}</p>
          <p className="text-xs text-slate-500">
            {ROLE_LABELS_AR[entry.acted_by_role] ?? entry.acted_by_role} · {new Date(entry.entered_at).toLocaleString('ar-SA')}
          </p>
        </li>
      ))}
    </ol>
  );
}
