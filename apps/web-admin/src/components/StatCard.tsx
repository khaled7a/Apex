import type { LucideIcon } from 'lucide-react';

const COLOR_CLASSES: Record<string, string> = {
  slate: 'bg-slate-50 text-slate-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700',
  red: 'bg-red-50 text-red-700',
  blue: 'bg-blue-50 text-blue-700',
};

export function StatCard({
  icon: Icon,
  label,
  value,
  color = 'slate',
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  color?: keyof typeof COLOR_CLASSES;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${COLOR_CLASSES[color]}`}>
        <Icon className="h-5 w-5" strokeWidth={2} />
      </span>
      <div>
        <p className="text-lg font-bold leading-tight text-slate-900">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}
