import type { LucideIcon } from 'lucide-react';

export function EmptyState({ icon: Icon, message, action }: { icon: LucideIcon; message: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        <Icon className="h-6 w-6" strokeWidth={1.75} />
      </span>
      <p className="text-sm text-slate-500">{message}</p>
      {action}
    </div>
  );
}
