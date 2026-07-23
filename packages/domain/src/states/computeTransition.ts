import { ActorRef } from './actor.types';
import { OrderState } from './order-states.const';
import { TransitionInput, TransitionResult, TransitionRow } from './transition.types';

/**
 * The single pure decision function for the entire order lifecycle.
 * Deny-by-default: an (from, event) pair not present in `table` is always
 * rejected, never silently accepted. No I/O, no side effects — the caller
 * (TransitionEngineService in apps/api) is responsible for actually
 * persisting the result inside a DB transaction.
 */
export function computeTransition(table: readonly TransitionRow[], input: TransitionInput): TransitionResult {
  const candidates = table.filter((r) => r.from === input.currentState && r.event === input.event);
  if (candidates.length === 0) {
    return {
      kind: 'REJECTED',
      reason: 'UNKNOWN_TRANSITION',
      detail: `no transition defined for (${input.currentState}, ${input.event})`,
    };
  }

  // Multiple rows sharing the same (from, event) key are guard-selected
  // routes (e.g. SUPPLIER_CHOICE fanning out by service_type) — try each
  // candidate in order and accept the first whose role+guards both pass.
  // Only reject once every candidate has failed, surfacing the last reason.
  let lastRejection: TransitionResult | null = null;
  for (const row of candidates) {
    if (!isRoleAllowed(row, input.actor)) {
      lastRejection = {
        kind: 'REJECTED',
        reason: 'ROLE_NOT_ALLOWED',
        detail: `role ${input.actor.role} may not fire event ${input.event} from ${input.currentState}`,
      };
      continue;
    }

    const failedGuard = (row.guards ?? []).map((g) => ({ g, result: g.check(input.ctx) })).find((x) => !x.result.ok);
    if (failedGuard) {
      lastRejection = {
        kind: 'REJECTED',
        reason: 'GUARD_FAILED',
        detail: `${failedGuard.g.name}: ${(failedGuard.result as { ok: false; reason: string }).reason}`,
      };
      continue;
    }

    const toState = resolveDestination(row, input);
    return { kind: 'ACCEPTED', row, toState };
  }

  return lastRejection as TransitionResult;
}

function isRoleAllowed(row: TransitionRow, actor: ActorRef): boolean {
  return row.allowedRoles.includes(actor.role);
}

function resolveDestination(row: TransitionRow, input: TransitionInput): OrderState {
  // Rule from state-machine.md §5: any path landing on CANCELLED after a
  // trust-fund payment was ever confirmed is redirected to the mandatory
  // refund dispute instead — never a silent, undisputed cancellation.
  if (row.forceMandatoryRefundIfEverConfirmed && input.ctx.hasEverConfirmedSupplierPayment) {
    return 'DISPUTE_MANDATORY_REFUND';
  }
  if (row.resolveDynamicTarget) {
    return row.resolveDynamicTarget(input.ctx);
  }
  return row.to;
}
