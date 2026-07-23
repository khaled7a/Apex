import { ANY_ADMIN } from './actor.types';
import { OrderState } from './order-states.const';
import { TRANSITIONS } from './transitions.table';

export interface AdminActionableTransition {
  event: string;
  allowedRoles: readonly string[];
}

/**
 * Computed once from TRANSITIONS — a state is "admin actionable" if it has
 * at least one outgoing transition whose allowedRoles is a non-empty subset
 * of ANY_ADMIN. Deliberately broader than "only admin can ever move this
 * forward" (e.g. CONTRACT_RECEIPT_REJECTED also lets the customer re-upload,
 * ESCALATION_ESCALATED also lets customer/supplier respond) — those are
 * exactly the states an admin dashboard needs to surface as candidates
 * needing attention, even if another actor might resolve them first.
 * Never hand-list states here; if TRANSITIONS changes, this changes with it.
 */
export const ADMIN_ACTIONABLE_TRANSITIONS: ReadonlyMap<OrderState, AdminActionableTransition[]> = (() => {
  const map = new Map<OrderState, AdminActionableTransition[]>();
  const adminRoles = new Set<string>(ANY_ADMIN);
  for (const row of TRANSITIONS) {
    if (row.allowedRoles.length === 0 || !row.allowedRoles.every((role) => adminRoles.has(role))) continue;
    const bucket = map.get(row.from) ?? [];
    bucket.push({ event: row.event, allowedRoles: row.allowedRoles });
    map.set(row.from, bucket);
  }
  return map;
})();

export const ADMIN_ACTIONABLE_STATES: ReadonlySet<OrderState> = new Set(ADMIN_ACTIONABLE_TRANSITIONS.keys());

export function isAdminActionableState(state: OrderState): boolean {
  return ADMIN_ACTIONABLE_STATES.has(state);
}
