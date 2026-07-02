import { describe, expect, it } from 'vitest';
import { TRANSITIONS } from './transitions.table';
import { ORDER_STATES, FINAL_STATES, PSEUDO_STATES, OrderState } from './order-states.const';
import { computeTransition } from './computeTransition';
import { makeCtx } from '../test-helpers/context';

describe('transitions table — structural completeness', () => {
  it('every `to` and `from` state exists in the ORDER_STATES enum', () => {
    const known = new Set<string>(ORDER_STATES);
    for (const row of TRANSITIONS) {
      expect(known.has(row.from), `unknown from-state: ${row.from}`).toBe(true);
      expect(known.has(row.to), `unknown to-state: ${row.to}`).toBe(true);
    }
  });

  it('every row has at least one allowed role', () => {
    for (const row of TRANSITIONS) {
      expect(row.allowedRoles.length, `${row.from} -(${row.event})-> ${row.to} has no allowed roles`).toBeGreaterThan(
        0,
      );
    }
  });

  it('no (from, event) pair maps to conflicting outcomes without a guard telling them apart', () => {
    const seen = new Map<string, number>();
    for (const row of TRANSITIONS) {
      const key = `${row.from}::${row.event}`;
      seen.set(key, (seen.get(key) ?? 0) + 1);
      // Multiple rows for the same (from,event) are fine ONLY if guarded —
      // e.g. SUPPLIER_CHOICE routing by service_type flags.
      if ((seen.get(key) ?? 0) > 1) {
        expect(row.guards?.length ?? 0, `${key} has multiple rows but row is unguarded`).toBeGreaterThan(0);
      }
    }
  });

  it('every non-final, non-pseudo state has at least one outgoing edge', () => {
    const withOutgoing = new Set(TRANSITIONS.map((r) => r.from));
    for (const state of ORDER_STATES) {
      if (FINAL_STATES.includes(state) || PSEUDO_STATES.includes(state)) continue;
      expect(withOutgoing.has(state), `state ${state} has no outgoing transition — dead end`).toBe(true);
    }
  });

  it('every non-initial state has at least one incoming edge (no unreachable state)', () => {
    const withIncoming = new Set(TRANSITIONS.map((r) => r.to));
    // resolveDynamicTarget rows point at a placeholder `to`; also count their
    // plausible real destinations by re-running them through computeTransition
    // with a representative context so dynamically-resolved targets are credited.
    for (const row of TRANSITIONS) {
      if (row.resolveDynamicTarget) {
        const ctx = makeCtx({ currentState: row.from, resumeTargetState: 'PROD_CHECKPOINT_1' });
        withIncoming.add(row.resolveDynamicTarget(ctx));
      }
      if (row.forceMandatoryRefundIfEverConfirmed) {
        withIncoming.add('DISPUTE_MANDATORY_REFUND');
      }
    }
    for (const state of ORDER_STATES) {
      if (state === 'DRAFT') continue; // the only true initial state
      expect(withIncoming.has(state), `state ${state} is unreachable — no transition leads to it`).toBe(true);
    }
  });
});

describe('computeTransition — deny by default', () => {
  it('rejects an event that is not defined for the current state', () => {
    const result = computeTransition(TRANSITIONS, {
      currentState: 'DRAFT',
      event: 'some_made_up_event',
      actor: { role: 'CUSTOMER', id: 'c1' },
      ctx: makeCtx({ currentState: 'DRAFT' }),
    });
    expect(result.kind).toBe('REJECTED');
    if (result.kind === 'REJECTED') expect(result.reason).toBe('UNKNOWN_TRANSITION');
  });

  it('rejects a role that is not permitted to fire an otherwise-valid event', () => {
    const result = computeTransition(TRANSITIONS, {
      currentState: 'DRAFT',
      event: 'submit',
      actor: { role: 'SUPPLIER', id: 's1' }, // only CUSTOMER may submit
      ctx: makeCtx({ currentState: 'DRAFT' }),
    });
    expect(result.kind).toBe('REJECTED');
    if (result.kind === 'REJECTED') expect(result.reason).toBe('ROLE_NOT_ALLOWED');
  });

  it('accepts a valid (state, event, role) combination', () => {
    const result = computeTransition(TRANSITIONS, {
      currentState: 'DRAFT',
      event: 'submit',
      actor: { role: 'CUSTOMER', id: 'c1' },
      ctx: makeCtx({ currentState: 'DRAFT' }),
    });
    expect(result).toEqual({ kind: 'ACCEPTED', row: expect.anything(), toState: 'SUBMITTED' });
  });

  it('fuzz: every (state, undefined event) combination is rejected, never silently accepted', () => {
    for (const state of ORDER_STATES) {
      const result = computeTransition(TRANSITIONS, {
        currentState: state,
        event: '__nonexistent_event__',
        actor: { role: 'SYSTEM', id: null },
        ctx: makeCtx({ currentState: state }),
      });
      expect(result.kind, `state ${state} unexpectedly accepted an undefined event`).toBe('REJECTED');
    }
  });
});

describe('computeTransition — critical business rules', () => {
  it('service_type routes SUPPLIER_CHOICE to LOGISTICS_ONLY_SETUP when sourcing is disabled', () => {
    const ctx = makeCtx({
      currentState: 'SUPPLIER_CHOICE',
      serviceType: { includesSourcing: false, includesIdentityManagement: false, includesProductionOversight: false },
      supplierType: 'NONE',
    });
    const result = computeTransition(TRANSITIONS, {
      currentState: 'SUPPLIER_CHOICE',
      event: 'route',
      actor: { role: 'SYSTEM', id: null },
      ctx,
    });
    expect(result).toMatchObject({ kind: 'ACCEPTED', toState: 'LOGISTICS_ONLY_SETUP' });
  });

  it('service_type routes SUPPLIER_CHOICE to REG_PUBLISHED for a registered supplier with sourcing enabled', () => {
    const ctx = makeCtx({ currentState: 'SUPPLIER_CHOICE', supplierType: 'REGISTERED' });
    const result = computeTransition(TRANSITIONS, {
      currentState: 'SUPPLIER_CHOICE',
      event: 'route',
      actor: { role: 'SYSTEM', id: null },
      ctx,
    });
    expect(result).toMatchObject({ kind: 'ACCEPTED', toState: 'REG_PUBLISHED' });
  });

  it('bidding deadline with zero offers lands on REG_BIDS_EXPIRED_NO_OFFERS, not REG_ADMIN_REVIEW_BIDS', () => {
    const ctx = makeCtx({ currentState: 'REG_BIDS_COLLECTING', offerCount: 0 });
    const result = computeTransition(TRANSITIONS, {
      currentState: 'REG_BIDS_COLLECTING',
      event: 'deadline_reached',
      actor: { role: 'SYSTEM', id: null },
      ctx,
    });
    expect(result).toMatchObject({ kind: 'ACCEPTED', toState: 'REG_BIDS_EXPIRED_NO_OFFERS' });
  });

  it('identity reveal only fires on the first escrow payment', () => {
    const notFirst = makeCtx({ currentState: 'SUPPLIER_PAYMENT_CONFIRMED', isFirstEscrowPayment: false });
    const result = computeTransition(TRANSITIONS, {
      currentState: 'SUPPLIER_PAYMENT_CONFIRMED',
      event: 'reveal_identity',
      actor: { role: 'SYSTEM', id: null },
      ctx: notFirst,
    });
    expect(result.kind).toBe('REJECTED');
  });

  it('any cancellation after a confirmed escrow payment is redirected to DISPUTE_MANDATORY_REFUND', () => {
    const ctx = makeCtx({ currentState: 'RENEWAL_SUPPLIER_DECLINED', hasEverConfirmedSupplierPayment: true });
    const result = computeTransition(TRANSITIONS, {
      currentState: 'RENEWAL_SUPPLIER_DECLINED',
      event: 'customer_prefers_full_cancel',
      actor: { role: 'CUSTOMER', id: 'c1' },
      ctx,
    });
    expect(result).toMatchObject({ kind: 'ACCEPTED', toState: 'DISPUTE_MANDATORY_REFUND' });
  });

  it('the same cancellation lands on plain CANCELLED when no escrow payment was ever confirmed', () => {
    const ctx = makeCtx({ currentState: 'RENEWAL_SUPPLIER_DECLINED', hasEverConfirmedSupplierPayment: false });
    const result = computeTransition(TRANSITIONS, {
      currentState: 'RENEWAL_SUPPLIER_DECLINED',
      event: 'customer_prefers_full_cancel',
      actor: { role: 'CUSTOMER', id: 'c1' },
      ctx,
    });
    expect(result).toMatchObject({ kind: 'ACCEPTED', toState: 'CANCELLED' });
  });

  it('cannot open a second dispute while one is already active', () => {
    const ctx = makeCtx({ currentState: 'CONTRACT_SIGNED', hasActiveDispute: true });
    const result = computeTransition(TRANSITIONS, {
      currentState: 'CONTRACT_SIGNED',
      event: 'open_payment_dispute',
      actor: { role: 'CUSTOMER', id: 'c1' },
      ctx,
    });
    expect(result.kind).toBe('REJECTED');
    if (result.kind === 'REJECTED') expect(result.reason).toBe('GUARD_FAILED');
  });

  it('dispute resolution resumes the exact frozen state, not a generic restart', () => {
    const ctx = makeCtx({ currentState: 'DISPUTE_QUALITY', resumeTargetState: 'PROD_CHECKPOINT_2' });
    const result = computeTransition(TRANSITIONS, {
      currentState: 'DISPUTE_QUALITY',
      event: 'admin_resolves_dispute',
      actor: { role: 'ADMIN_OWNER', id: 'a1' },
      ctx,
    });
    expect(result).toMatchObject({ kind: 'ACCEPTED', toState: 'PROD_CHECKPOINT_2' });
  });

  it('Rejected orders are no longer a dead end — they auto-close to CANCELLED', () => {
    const ctx = makeCtx({ currentState: 'REVIEW_REJECTED' });
    const result = computeTransition(TRANSITIONS, {
      currentState: 'REVIEW_REJECTED',
      event: 'auto_close',
      actor: { role: 'SYSTEM', id: null },
      ctx,
    });
    expect(result).toMatchObject({ kind: 'ACCEPTED', toState: 'CANCELLED' });
  });

  it('a supplier missing its own SLA is escalated too, not just a silent customer-only path', () => {
    const ctx = makeCtx({ currentState: 'PROD_DESIGN_SUBMITTED' });
    const result = computeTransition(TRANSITIONS, {
      currentState: 'PROD_DESIGN_SUBMITTED',
      event: 'supplier_sla_expired',
      actor: { role: 'SYSTEM', id: null },
      ctx,
    });
    expect(result).toMatchObject({ kind: 'ACCEPTED', toState: 'ESCALATION_REMINDER' });
  });
});
