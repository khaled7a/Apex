import { Inject, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { ActorRef, computeTransition, GuardContext, OrderState, TRANSITIONS } from '@apex/domain';
import { Kysely, Transaction } from 'kysely';
import { KYSELY } from '../database/database.module';
import { DB } from '../database/db.types';
import { UnitOfWork } from '../database/unit-of-work';
import { AuditLogService } from '../audit/audit-log.service';
import { buildGuardContext } from './build-guard-context';
import { StaleStateError, TransitionRejectedError } from './transition-engine.errors';
import { DISPUTE_TYPE_BY_STATE, ESCALATION_ACTOR_BY_EVENT, isDisputeState, isEscalationState, isRenewalState } from './hold-state.util';
import { TIMER_SCHEDULER, TimerSchedulerPort } from '../scheduler/timer-scheduler.port';
import { NotificationsService } from '../notifications/notifications.service';

export interface TransitionRequest {
  orderId: string;
  event: string;
  actor: ActorRef;
  expectedStateVersion: number;
  /** Extra fields the base order-row context can't compute alone (offerCount, escalationActor, ...). */
  ctxOverrides?: Partial<GuardContext>;
  /** Free-form data recorded on state_transition_log.payload for this transition. */
  payload?: Record<string, unknown>;
  /** Module-specific side effect (e.g. lock a payment row) run inside the SAME transaction, before the state is updated. */
  effect?: (trx: Transaction<DB>, ctx: GuardContext, toState: OrderState) => Promise<void>;
}

export interface TransitionOutcome {
  fromState: OrderState;
  toState: OrderState;
  event: string;
  /** The order's state_version after this transition — read this back instead of hand-incrementing expectedStateVersion for a chained call, since a self-loop does not bump it. */
  stateVersion: number;
}

/**
 * The single place any code is allowed to change `order.current_state`.
 * Every module (orders, bidding, contracts, payments, disputes, ...) calls
 * this instead of writing to the column directly — see docs/state-machine.md
 * §0 and the implementation plan appended to the review document.
 */
@Injectable()
export class TransitionEngineService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<DB>,
    private readonly uow: UnitOfWork,
    private readonly auditLog: AuditLogService,
    private readonly notifications: NotificationsService,
    @Optional() @Inject(TIMER_SCHEDULER) private readonly scheduler?: TimerSchedulerPort,
  ) {}

  async transition(request: TransitionRequest): Promise<TransitionOutcome> {
    const trx = this.uow.getClient();

    // Locks the row for the remainder of this transaction — any concurrent
    // transition attempt on the same order blocks here until we commit/rollback.
    const order = await trx
      .selectFrom('order')
      .selectAll()
      .where('id', '=', request.orderId)
      .forUpdate()
      .executeTakeFirst();
    if (!order) {
      throw new NotFoundException(`order ${request.orderId} not found`);
    }

    if (order.state_version !== request.expectedStateVersion) {
      throw new StaleStateError(order.current_state, order.state_version);
    }

    const baseCtx = await buildGuardContext(trx, order);
    const ctx: GuardContext = { ...baseCtx, ...request.ctxOverrides };

    const result = computeTransition(TRANSITIONS, {
      currentState: order.current_state,
      event: request.event,
      actor: request.actor,
      ctx,
    });

    if (result.kind === 'REJECTED') {
      throw new TransitionRejectedError(result.reason, result.detail);
    }

    const fromState = order.current_state;
    const toState = result.toState;

    if (request.effect) {
      await request.effect(trx, ctx, toState);
    }

    // ---- generic hold-state bookkeeping (dispute/escalation/renewal open + close) ----
    const wasInHold = order.hold_type !== 'NONE';
    const enteringDispute = isDisputeState(toState);
    const enteringEscalation = isEscalationState(toState);
    // Discovered while wiring up the renewal path: AGREEMENT_CANCELLED_PENDING_RENEWAL/
    // RENEWAL_* continue the same wait ESCALATION_ESCALATED started (via
    // customer_no_response_final) — without accounting for them here, leaving
    // ESCALATION into one of these was wrongly counted as "fully left the
    // hold," wiping resume_target_state before admin_approves ever got to
    // resume it (silently losing real progress back to the default fallback state).
    const enteringRenewal = isRenewalState(toState);
    const leavingHold = wasInHold && !enteringDispute && !enteringEscalation && !enteringRenewal;

    let newResumeTargetState = order.resume_target_state;
    if (!wasInHold && (enteringDispute || enteringEscalation || enteringRenewal)) {
      newResumeTargetState = fromState; // snapshot the exact point of interruption
    }
    if (leavingHold) {
      newResumeTargetState = null;
    }
    const newHoldType = enteringDispute ? 'DISPUTE' : enteringEscalation ? 'ESCALATION' : enteringRenewal ? 'RENEWAL' : 'NONE';

    let newActiveDisputeId = order.active_dispute_id;
    // Keyed off "no dispute row tracked yet" rather than "!wasInHold" —
    // discovered during review that an order transitioning directly from an
    // ESCALATION hold into a DISPUTE state (e.g. supplier_no_response_final,
    // open_delay_dispute) has wasInHold=true, so the old `!wasInHold` guard
    // skipped creating the dispute row entirely: hold_type became 'DISPUTE'
    // with active_dispute_id left null, invisible to admin dispute queries.
    if (enteringDispute && !order.active_dispute_id) {
      const disputeType = DISPUTE_TYPE_BY_STATE[toState];
      if (disputeType) {
        const created = await trx
          .insertInto('dispute')
          .values({
            order_id: order.id,
            type: disputeType as DB['dispute']['type'],
            opened_by_role: request.actor.role,
            resume_target_state_snapshot: fromState,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        newActiveDisputeId = created.id;
      }
    }
    if (leavingHold && order.active_dispute_id) {
      await trx
        .updateTable('dispute')
        .set({
          status: 'RESOLVED',
          resolved_by: request.actor.role.startsWith('ADMIN') ? request.actor.id : null,
          resolved_at: new Date(),
        })
        .where('id', '=', order.active_dispute_id)
        .execute();
      newActiveDisputeId = null;
    }

    // Symmetric to the dispute bookkeeping above — discovered during v2
    // planning that no code anywhere populated ctx.escalationActor, making
    // requireEscalationActor unimplementable end-to-end. Creating the
    // `escalation` row here (keyed by which SLA-expiry event fired) lets
    // buildGuardContext resolve it automatically via active_escalation_id,
    // with zero per-caller wiring needed.
    let newActiveEscalationId = order.active_escalation_id;
    if (enteringEscalation && !order.active_escalation_id) {
      const escalationActor = ESCALATION_ACTOR_BY_EVENT[request.event];
      if (escalationActor) {
        const created = await trx
          .insertInto('escalation')
          .values({
            order_id: order.id,
            actor: escalationActor,
            escalated_at: toState === 'ESCALATION_ESCALATED' ? new Date() : null,
            reminder_sent_at: toState === 'ESCALATION_REMINDER' ? new Date() : null,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        newActiveEscalationId = created.id;
      }
    } else if (enteringEscalation && order.active_escalation_id && toState === 'ESCALATION_ESCALATED') {
      // Same escalation, deeper tier (no_response_timeout fired) — stamp
      // escalated_at on the existing row instead of opening a second one.
      await trx.updateTable('escalation').set({ escalated_at: new Date() }).where('id', '=', order.active_escalation_id).execute();
    }
    if (leavingHold && order.active_escalation_id) {
      await trx
        .updateTable('escalation')
        .set({ resolved_at: new Date(), outcome: 'RESPONDED' })
        .where('id', '=', order.active_escalation_id)
        .execute();
      newActiveEscalationId = null;
    }

    // ---- the atomic financial event: lock non-refundability + start the manufacturing clock ----
    // (state-machine.md's "atomic event" principle — this must not be two separate writes.)
    let financialCommitmentStartedAt = order.financial_commitment_started_at;
    if (toState === 'SUPPLIER_PAYMENT_CONFIRMED' && ctx.isFirstEscrowPayment && !financialCommitmentStartedAt) {
      financialCommitmentStartedAt = new Date();
    }

    // A self-loop (from === to, e.g. a supplier submitting a competing offer
    // during REG_BIDS_COLLECTING) does not bump state_version. state_version
    // exists to guard against racing WORKFLOW decisions (two admins
    // approving/rejecting the same order concurrently) — it is not meant to
    // fail every other supplier's bid the moment one of them lands, nor to
    // make a scheduled deadline timer's optimistic-lock check go stale the
    // instant a single offer is submitted during the entire bidding window.
    const isSelfLoop = toState === fromState;
    const nextStateVersion = isSelfLoop ? order.state_version : order.state_version + 1;

    await trx
      .updateTable('order')
      .set({
        current_state: toState,
        state_version: nextStateVersion,
        hold_type: newHoldType,
        resume_target_state: newResumeTargetState,
        active_dispute_id: newActiveDisputeId,
        active_escalation_id: newActiveEscalationId,
        financial_commitment_started_at: financialCommitmentStartedAt,
      })
      .where('id', '=', order.id)
      .where('state_version', '=', order.state_version) // belt-and-braces alongside FOR UPDATE
      .execute();

    await trx
      .updateTable('state_transition_log')
      .set({ exited_at: new Date() })
      .where('order_id', '=', order.id)
      .where('exited_at', 'is', null)
      .execute();
    await trx
      .insertInto('state_transition_log')
      .values({
        order_id: order.id,
        from_state: fromState,
        to_state: toState,
        event: request.event,
        acted_by_role: request.actor.role,
        acted_by_id: request.actor.id,
        payload: request.payload != null ? JSON.stringify(request.payload) : null,
      })
      .execute();

    await this.auditLog.write({
      entityType: 'order',
      entityId: order.id,
      action: request.event,
      actorId: request.actor.id,
      actorRole: request.actor.role,
      stateBefore: { current_state: fromState },
      stateAfter: { current_state: toState },
    });

    // Notification *intent* is recorded atomically here, alongside the state
    // change itself (docs/state-machine.md §0) — the actual network send is
    // best-effort, dispatched after commit by NotificationDispatchWorker.
    // Skipped for self-loops (e.g. a second competing offer during
    // REG_BIDS_COLLECTING) — nothing about the order's state actually changed.
    if (!isSelfLoop) {
      await this.notifications.recordAndEnqueue(trx, {
        id: order.id,
        customer_id: order.customer_id,
        registered_supplier_id: order.registered_supplier_id,
      });
    }

    for (const timerType of result.row.cancelsTimers ?? []) {
      await trx
        .updateTable('scheduled_timer')
        .set({ cancelled_at: new Date() })
        .where('order_id', '=', order.id)
        .where('timer_type', '=', timerType)
        .where('cancelled_at', 'is', null)
        .where('fired_at', 'is', null)
        .execute();
      // Best-effort only (see TimerSchedulerPort) — the row update above is
      // the real, transactional cancellation. If this fails or pg-boss still
      // fires late, the worker's own defensive re-check is what actually saves us.
      await this.scheduler?.cancel(order.id, timerType).catch(() => undefined);
    }
    if (result.row.schedulesTimer) {
      const directive = result.row.schedulesTimer(ctx);
      if (directive) {
        const runAt = new Date(Date.now() + directive.delayMs);
        await trx
          .insertInto('scheduled_timer')
          .values({
            order_id: order.id,
            timer_type: directive.type,
            run_at: runAt,
            expected_state_version: nextStateVersion,
          })
          .execute();
        // Enqueued before this outer transaction commits, on pg-boss's own
        // connection — if the transaction later rolls back, this becomes a
        // harmless orphan job: the worker's defensive re-check (does the
        // scheduled_timer row still exist and match?) finds nothing and no-ops.
        await this.scheduler?.enqueue(order.id, directive.type, runAt);
      }
    }

    return { fromState, toState, event: request.event, stateVersion: nextStateVersion };
  }
}
