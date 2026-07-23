import { AlertTriangle, Clock3, RefreshCw, CheckCircle2, XCircle, Circle } from 'lucide-react';
import { orderStateLabel } from '@/lib/state-labels';

const HOLD_STYLES: Record<string, { classes: string; icon: typeof Circle }> = {
  DISPUTE: { classes: 'bg-red-100 text-red-800', icon: AlertTriangle },
  ESCALATION: { classes: 'bg-amber-100 text-amber-800', icon: Clock3 },
  RENEWAL: { classes: 'bg-purple-100 text-purple-800', icon: RefreshCw },
};

export function OrderStateBadge({ state, holdType }: { state: string; holdType?: string }) {
  if (state === 'COMPLETED') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-800">
        <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.25} />
        {orderStateLabel(state)}
      </span>
    );
  }
  if (state === 'CANCELLED') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-200 px-3 py-1 text-xs font-medium text-slate-700">
        <XCircle className="h-3.5 w-3.5" strokeWidth={2.25} />
        {orderStateLabel(state)}
      </span>
    );
  }
  const hold = holdType ? HOLD_STYLES[holdType] : undefined;
  const Icon = hold?.icon ?? Circle;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${hold?.classes ?? 'bg-slate-100 text-slate-800'}`}>
      <Icon className="h-3.5 w-3.5" strokeWidth={2.25} />
      {orderStateLabel(state)}
    </span>
  );
}
