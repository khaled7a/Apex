import { OrderState } from './order-states.const';
import { ActorRef, ActorRole } from './actor.types';

export type TimerType =
  | 'BIDDING_DEADLINE'
  | 'CUSTOMER_SLA'
  | 'SUPPLIER_SLA'
  | 'ESCALATION_TIMEOUT'
  | 'PAYMENT_VERIFICATION_SLA';

export type DisputeType = 'PAYMENT' | 'QUALITY' | 'DELAY' | 'SHIPPING' | 'MANDATORY_REFUND';

/**
 * Everything a guard or timer-scheduling function needs to know about the
 * order to decide. This is plain data assembled by the caller (the
 * transition-engine in apps/api, from the DB row + request payload) — the
 * domain layer never touches a database.
 */
export interface GuardContext {
  orderId: string;
  currentState: OrderState;
  serviceType: {
    includesSourcing: boolean;
    includesIdentityManagement: boolean;
    includesProductionOversight: boolean;
  };
  supplierType: 'REGISTERED' | 'EXTERNAL' | 'NONE';
  hasActiveDispute: boolean;
  hasEverConfirmedSupplierPayment: boolean; // financial_commitment_started_at IS NOT NULL
  isFirstEscrowPayment: boolean; // true only for the very first trust-fund payment on this order
  offerCount?: number; // used by REG_BIDS_COLLECTING timeout guard
  /** Overrides the default 72h bidding window — lets ops shorten it per-environment (e.g. for staging/tests) without touching this table. */
  biddingDeadlineMs?: number;
  escalationActor?: 'CUSTOMER_APPROVAL' | 'SUPPLIER_DELIVERABLE';
  /** The frozen state to resume into, snapshotted when a dispute/escalation opened (state-machine.md §8). */
  resumeTargetState?: OrderState;
  /** Free-form event payload (rejection reasons, chosen offer id, etc.) — guards may read specific keys they know about. */
  payload?: Record<string, unknown>;
}

export type GuardResult = { ok: true } | { ok: false; reason: string };

export interface Guard {
  name: string;
  check: (ctx: GuardContext) => GuardResult;
}

export interface ScheduledTimerDirective {
  type: TimerType;
  delayMs: number;
}

export interface TransitionRow {
  from: OrderState;
  event: string;
  allowedRoles: readonly ActorRole[];
  guards?: readonly Guard[];
  to: OrderState;
  /** Timer types that must be atomically cancelled when this transition fires. */
  cancelsTimers?: readonly TimerType[];
  /** Optional: a new timer to schedule as part of this transition (e.g. entering REG_BIDS_COLLECTING). */
  schedulesTimer?: (ctx: GuardContext) => ScheduledTimerDirective | null;
  /**
   * Declarative flag: this transition is a cancellation that occurs after a
   * trust-fund payment was ever confirmed, so the engine must force-open a
   * DISPUTE_MANDATORY_REFUND instead of really landing on `to` (state-machine.md §5).
   * The `to` field for such rows is still 'CANCELLED' for documentation purposes;
   * computeTransition() rewrites the actual destination when this is set and the guard context says the payment was confirmed.
   */
  forceMandatoryRefundIfEverConfirmed?: boolean;
  /**
   * Some transitions (escalation response, dispute resolution) don't land on
   * a fixed `to` — they resume whatever state was frozen in `resume_target_state`
   * (state-machine.md §8). When present, this overrides `to` entirely; `to` is
   * kept as a documentation placeholder (usually the state the row was authored from).
   */
  resolveDynamicTarget?: (ctx: GuardContext) => OrderState;
}

export interface TransitionInput {
  currentState: OrderState;
  event: string;
  actor: ActorRef;
  ctx: GuardContext;
}

export type TransitionResult =
  | { kind: 'ACCEPTED'; row: TransitionRow; toState: OrderState }
  | { kind: 'REJECTED'; reason: 'UNKNOWN_TRANSITION' | 'ROLE_NOT_ALLOWED' | 'GUARD_FAILED'; detail?: string };
