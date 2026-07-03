import { orderStateLabel } from '@/lib/state-labels';

const HOLD_COLORS: Record<string, string> = {
  DISPUTE: 'bg-red-100 text-red-800',
  ESCALATION: 'bg-amber-100 text-amber-800',
  RENEWAL: 'bg-purple-100 text-purple-800',
};

export function OrderStateBadge({ state, holdType }: { state: string; holdType?: string }) {
  const colorClass = (holdType && HOLD_COLORS[holdType]) || 'bg-slate-100 text-slate-800';
  return <span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${colorClass}`}>{orderStateLabel(state)}</span>;
}
