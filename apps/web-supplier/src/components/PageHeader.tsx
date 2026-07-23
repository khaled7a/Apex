import type { LucideIcon } from 'lucide-react';

export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        {Icon && (
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <Icon className="h-5 w-5" strokeWidth={2} />
          </span>
        )}
        <div>
          <h1 className="text-xl font-bold text-slate-900">{title}</h1>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}
