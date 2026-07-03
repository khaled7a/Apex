import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Kysely } from 'kysely';
import { ActorRef, isFinalApproverRoleAllowed } from '@apex/domain';
import { KYSELY } from '../database/database.module';
import { DB } from '../database/db.types';
import { UnitOfWork } from '../database/unit-of-work';
import { TransitionEngineService } from '../transition-engine/transition-engine.service';
import { CreateCustomsFeeDto } from './dto/create-customs-fee.dto';
import { UploadCustomsProofDto } from './dto/upload-customs-proof.dto';
import { RejectProofDto } from './dto/reject-proof.dto';

@Injectable()
export class CustomsFeesService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<DB>,
    private readonly uow: UnitOfWork,
    private readonly engine: TransitionEngineService,
  ) {}

  async startCustoms(orderId: string, actor: ActorRef, expectedStateVersion: number) {
    return this.engine.transition({ orderId, event: 'start_customs', actor, expectedStateVersion });
  }

  /** Plain insert, status=DRAFT — no transition yet. Matches the DB CHECK (customs_fee_four_eyes / customs_fee_publish_requires_approval): a DRAFT fee needs no approver, but nothing in DRAFT is ever shown to the customer. */
  async createDraftFee(orderId: string, actor: ActorRef, dto: CreateCustomsFeeDto) {
    const trx = this.uow.getClient();
    return trx
      .insertInto('customs_fee')
      .values({ order_id: orderId, label: dto.label, amount_sar: dto.amountSar, created_by: actor.id! })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  /**
   * The ONLY entry point that publishes a fee and fires `fee_published` —
   * mirrors PaymentsService.approveAdminVerification and
   * DisputesService.approveMandatoryRefundResolution: no other route exposes
   * `fee_published` directly, so a fee can never reach the customer without
   * passing through this real two-person check. Enforces the same rule the
   * DB's `customs_fee_four_eyes` CHECK constraint backs up: the approver must
   * be a different person than whoever created the draft, AND must hold
   * ACCOUNTANT/OWNER (PERMISSION_MATRIX's CUSTOMS_FEE_MANAGE.finalApproverRoles) —
   * a plain OPERATOR creating and a different OPERATOR "approving" is exactly
   * the gap discovered and fixed for SUPPLIER_PAYMENT_ADMIN_VERIFICATION.
   */
  async approveFee(orderId: string, feeId: string, actor: ActorRef, expectedStateVersion: number) {
    if (!isFinalApproverRoleAllowed('CUSTOMS_FEE_MANAGE', actor.role)) {
      throw new ForbiddenException(`role ${actor.role} is not permitted to give final approval for a customs fee`);
    }
    const trx = this.uow.getClient();
    const fee = await trx.selectFrom('customs_fee').selectAll().where('id', '=', feeId).where('order_id', '=', orderId).executeTakeFirst();
    if (!fee) throw new NotFoundException(`customs fee ${feeId} not found on order ${orderId}`);
    if (fee.status !== 'DRAFT') throw new BadRequestException(`fee is already ${fee.status}`);
    if (fee.created_by === actor.id) {
      throw new BadRequestException('the approver must be a different admin than whoever created the fee');
    }

    return this.engine.transition({
      orderId,
      event: 'fee_published',
      actor,
      expectedStateVersion,
      effect: async (effectTrx) => {
        await effectTrx.updateTable('customs_fee').set({ status: 'PUBLISHED', approved_by: actor.id }).where('id', '=', feeId).execute();
      },
    });
  }

  async customerPaysUploadsProof(orderId: string, customerId: string, dto: UploadCustomsProofDto) {
    const trx = this.uow.getClient();
    await trx.insertInto('shipping_document').values({ order_id: orderId, doc_type: 'customs_fee_proof', file_url: dto.fileUrl }).execute();
    return this.engine.transition({
      orderId,
      event: 'customer_pays_uploads_proof',
      actor: { role: 'CUSTOMER', id: customerId },
      expectedStateVersion: dto.expectedStateVersion,
    });
  }

  async adminVerifiesFee(orderId: string, actor: ActorRef, expectedStateVersion: number) {
    return this.engine.transition({ orderId, event: 'admin_verifies_fee', actor, expectedStateVersion });
  }

  async rejectProof(orderId: string, actor: ActorRef, dto: RejectProofDto) {
    return this.engine.transition({
      orderId,
      event: 'proof_rejected',
      actor,
      expectedStateVersion: dto.expectedStateVersion,
      payload: { reason: dto.reason },
    });
  }

  async addMoreFees(orderId: string, actor: ActorRef, expectedStateVersion: number) {
    return this.engine.transition({ orderId, event: 'add_more_fees', actor, expectedStateVersion });
  }

  async noMoreFees(orderId: string, actor: ActorRef, expectedStateVersion: number) {
    return this.engine.transition({ orderId, event: 'no_more_fees', actor, expectedStateVersion });
  }
}
