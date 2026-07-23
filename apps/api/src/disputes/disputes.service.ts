import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { ActorRef, PermissionAction } from '@apex/domain';
import { KYSELY } from '../database/database.module';
import { DB } from '../database/db.types';
import { UnitOfWork } from '../database/unit-of-work';
import { TransitionEngineService } from '../transition-engine/transition-engine.service';
import { FinancialApprovalService } from '../financial-approval/financial-approval.service';
import { ResolveMandatoryRefundDto } from './dto/resolve-mandatory-refund.dto';

const SYSTEM: ActorRef = { role: 'SYSTEM', id: null };
const MANDATORY_REFUND_ACTION: PermissionAction = 'DISPUTE_RESOLVE_MANDATORY_REFUND';

@Injectable()
export class DisputesService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<DB>,
    private readonly uow: UnitOfWork,
    private readonly engine: TransitionEngineService,
    private readonly financialApproval: FinancialApprovalService,
  ) {}

  /** Generic dispute-opening: `event` is one of the `open_*_dispute` events in the transition table. */
  async openDispute(orderId: string, actor: ActorRef, event: string, expectedStateVersion: number) {
    return this.engine.transition({ orderId, event, actor, expectedStateVersion });
  }

  /** Resumes to the exact frozen point automatically — buildGuardContext reads order.resume_target_state itself. */
  async resolveOrdinaryDispute(orderId: string, actor: ActorRef, expectedStateVersion: number) {
    return this.engine.transition({ orderId, event: 'admin_resolves_dispute', actor, expectedStateVersion });
  }

  async markUnresolved(orderId: string, actor: ActorRef, expectedStateVersion: number) {
    return this.engine.transition({ orderId, event: 'admin_marks_unresolved', actor, expectedStateVersion });
  }

  /**
   * Demonstrates state-machine.md §5's forced rule directly: cancelling an
   * order after a trust-fund payment was ever confirmed is automatically
   * redirected to DISPUTE_MANDATORY_REFUND instead of a silent CANCELLED —
   * regardless of *why* the admin is cancelling.
   */
  async adminCancelOrder(orderId: string, actor: ActorRef, expectedStateVersion: number) {
    return this.engine.transition({ orderId, event: 'admin_cancel_order', actor, expectedStateVersion });
  }

  /**
   * Step 1 of real four-eyes: names the required approver. Role membership
   * (must be OWNER/ACCOUNTANT) and "must be the other role than the
   * submitter" are both enforced centrally by FinancialApprovalService from
   * PERMISSION_MATRIX — discovered during review that this method used to
   * hand-roll an OWNER_ACCOUNTANT_ROLES Set here, a duplicate of the matrix
   * that could silently drift out of sync with it.
   */
  async proposeMandatoryRefundResolution(orderId: string, submitterActor: ActorRef, approverId: string) {
    return this.financialApproval.propose({
      entityType: 'order',
      entityId: orderId,
      action: MANDATORY_REFUND_ACTION,
      submitterId: submitterActor.id!,
      approverId,
    });
  }

  /** Step 2: the designated OWNER/ACCOUNTANT counterpart approves — only then does the refund actually get recorded and the order close. */
  async approveMandatoryRefundResolution(orderId: string, approverActor: ActorRef, dto: ResolveMandatoryRefundDto) {
    const approval = await this.financialApproval.approve({
      entityType: 'order',
      entityId: orderId,
      action: MANDATORY_REFUND_ACTION,
      approverId: approverActor.id!,
    });

    const submitterRole = await this.financialApproval.getAdminRole(approval.submitter_id);
    const approverRole = await this.financialApproval.getAdminRole(approval.approver_id);
    const ownerId = submitterRole === 'ADMIN_OWNER' ? approval.submitter_id : approval.approver_id;
    const accountantId = approverRole === 'ADMIN_ACCOUNTANT' ? approval.approver_id : approval.submitter_id;

    const trx = this.uow.getClient();
    const order = await trx.selectFrom('order').select(['active_dispute_id']).where('id', '=', orderId).executeTakeFirstOrThrow();
    if (!order.active_dispute_id) {
      throw new BadRequestException('order has no active dispute to resolve');
    }

    const resolved = await this.engine.transition({
      orderId,
      event: 'resolve_with_refund_decision',
      actor: approverActor,
      expectedStateVersion: dto.expectedStateVersion,
      effect: async (effectTrx) => {
        await effectTrx
          .insertInto('refund_transaction')
          .values({
            payment_id: dto.paymentId,
            dispute_id: order.active_dispute_id,
            refunded_amount_sar: dto.refundedAmountSar,
            refund_ratio: dto.refundRatio,
            decided_by_owner: ownerId,
            decided_by_accountant: accountantId,
            reason: dto.reason,
          })
          .execute();
      },
    });

    const closed = await this.engine.transition({ orderId, event: 'final_close', actor: SYSTEM, expectedStateVersion: resolved.stateVersion });
    return { resolved, closed };
  }
}
