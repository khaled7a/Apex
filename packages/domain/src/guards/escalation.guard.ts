import { Guard } from '../states/transition.types';

export function requireEscalationActor(expected: 'CUSTOMER_APPROVAL' | 'SUPPLIER_DELIVERABLE'): Guard {
  return {
    name: `requireEscalationActor(${expected})`,
    check: (ctx) =>
      ctx.escalationActor === expected
        ? { ok: true }
        : { ok: false, reason: `escalation actor mismatch, expected ${expected}` },
  };
}
