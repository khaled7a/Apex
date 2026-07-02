import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Kysely } from 'kysely';
import { ActorRef } from '@apex/domain';
import { KYSELY } from '../database/database.module';
import { DB } from '../database/db.types';
import { UnitOfWork } from '../database/unit-of-work';
import { TransitionEngineService } from '../transition-engine/transition-engine.service';
import { FinancialApprovalService } from '../financial-approval/financial-approval.service';
import { ResolveMandatoryRefundDto } from './dto/resolve-mandatory-refund.dto';

const SYSTEM: ActorRef = { role: 'SYSTEM', id: null };
const MANDATORY_REFUND_ACTION = 'DISPUTE_RESOLVE_MANDATORY_REFUND';
const OWNER_ACCOUNTANT_ROLES = new Set(['ADMIN_OWNER', 'ADMIN_ACCOUNTANT']);

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

  private async requireOwnerOrAccountant(adminId: string): Promise<'ADMIN_OWNER' | 'ADMIN_ACCOUNTANT'> {
    const trx = this.uow.getClient();
    const admin = await trx.selectFrom('admin_user').select(['role']).where('id', '=', adminId).executeTakeFirst();
    if (!admin) throw new NotFoundException(`admin ${adminId} not found`);
    const role = `ADMIN_${admin.role}`;
    if (!OWNER_ACCOUNTANT_ROLES.has(role)) {
      throw new BadRequestException(`admin ${adminId} is ${role}, but mandatory-refund resolution requires OWNER or ACCOUNTANT`);
    }
    return role as 'ADMIN_OWNER' | 'ADMIN_ACCOUNTANT';
  }

  /** Step 1 of real four-eyes: submitter (OWNER or ACCOUNTANT) names the *other* role as the required approver. */
  async proposeMandatoryRefundResolution(orderId: string, submitterActor: ActorRef, approverId: string) {
    const submitterRole = await this.requireOwnerOrAccountant(submitterActor.id!);
    const approverRole = await this.requireOwnerOrAccountant(approverId);
    if (approverRole === submitterRole) {
      throw new BadRequestException('the approver must be the OTHER of OWNER/ACCOUNTANT, not the same role as the submitter');
    }
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

    const submitterRole = await this.requireOwnerOrAccountant(approval.submitter_id);
    const approverRole = await this.requireOwnerOrAccountant(approval.approver_id);
    const ownerId = submitterRole === 'ADMIN_OWNER' ? approval.submitter_id : approval.approver_id;
    const accountantId = approverRole === 'ADMIN_ACCOUNTANT' ? approval.approver_id : approval.submitter_id;

    const trx = this.uow.getClient();
    const order = await trx.selectFrom('order').select(['active_dispute_id']).where('id', '=', orderId).executeTakeFirstOrThrow();
    if (!order.active_dispute_id) {
      throw new BadRequestException('order has no active dispute to resolve');
    }

    let version = dto.expectedStateVersion;
    const resolved = await this.engine.transition({
      orderId,
      event: 'resolve_with_refund_decision',
      actor: approverActor,
      expectedStateVersion: version,
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
    version += 1;

    const closed = await this.engine.transition({ orderId, event: 'final_close', actor: SYSTEM, expectedStateVersion: version });
    return { resolved, closed };
  }
}
