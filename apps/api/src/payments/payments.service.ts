import { createHash } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kysely } from 'kysely';
import { ActorRef, PermissionAction } from '@apex/domain';
import { KYSELY } from '../database/database.module';
import { DB } from '../database/db.types';
import { UnitOfWork } from '../database/unit-of-work';
import { TransitionEngineService } from '../transition-engine/transition-engine.service';
import { TransitionRejectedError } from '../transition-engine/transition-engine.errors';
import { FinancialApprovalService } from '../financial-approval/financial-approval.service';
import { NotifyTransferDto } from './dto/notify-transfer.dto';
import { UploadReceiptDto } from './dto/upload-receipt.dto';
import { AppConfig } from '../config/configuration';

const SYSTEM: ActorRef = { role: 'SYSTEM', id: null };
const SUPPLIER_PAYMENT_VERIFICATION: PermissionAction = 'SUPPLIER_PAYMENT_ADMIN_VERIFICATION';

@Injectable()
export class PaymentsService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<DB>,
    private readonly uow: UnitOfWork,
    private readonly engine: TransitionEngineService,
    private readonly financialApproval: FinancialApprovalService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  private async assertSupplierOwnsOrder(orderId: string, supplierId: string) {
    const trx = this.uow.getClient();
    const order = await trx.selectFrom('order').select(['registered_supplier_id']).where('id', '=', orderId).executeTakeFirst();
    if (!order || order.registered_supplier_id !== supplierId) {
      throw new ForbiddenException('you are not the awarded supplier for this order');
    }
  }

  async notifyTransfer(orderId: string, actor: ActorRef, dto: NotifyTransferDto) {
    const trx = this.uow.getClient();
    const installment = await trx
      .selectFrom('payment_installment')
      .selectAll()
      .where('id', '=', dto.installmentId)
      .executeTakeFirst();
    if (!installment) throw new NotFoundException(`installment ${dto.installmentId} not found`);

    const payment = await trx
      .insertInto('payment')
      .values({
        installment_id: installment.id,
        amount_sar: installment.expected_amount_sar,
        paid_at: new Date(),
        refund_policy: installment.refund_policy,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    const outcome = await this.engine.transition({ orderId, event: 'notify_transfer', actor, expectedStateVersion: dto.expectedStateVersion });
    return { payment, outcome };
  }

  async uploadReceipt(orderId: string, actor: ActorRef, dto: UploadReceiptDto) {
    const trx = this.uow.getClient();
    const order = await trx.selectFrom('order').select(['current_state']).where('id', '=', orderId).executeTakeFirstOrThrow();
    const event = order.current_state === 'CONTRACT_RECEIPT_REJECTED' ? 'reupload_receipt' : 'upload_receipt';

    const fingerprint = createHash('sha256')
      .update(`${dto.bankReferenceNo}|${dto.amountClaimed}|${dto.transferDateClaimed}`)
      .digest('hex');

    let receipt;
    try {
      receipt = await trx
        .insertInto('receipt')
        .values({
          payment_id: dto.paymentId,
          file_url: dto.fileUrl,
          bank_reference_no: dto.bankReferenceNo,
          bank_name: dto.bankName,
          amount_claimed: dto.amountClaimed,
          transfer_date_claimed: dto.transferDateClaimed,
          receipt_fingerprint: fingerprint,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictException('this exact transfer (reference + amount + date) has already been used for another payment');
      }
      throw err;
    }

    const outcome = await this.engine.transition({ orderId, event, actor, expectedStateVersion: dto.expectedStateVersion });
    return { receipt, outcome };
  }

  async startVerification(orderId: string, actor: ActorRef, expectedStateVersion: number) {
    return this.engine.transition({ orderId, event: 'start_verification', actor, expectedStateVersion });
  }

  /**
   * Confirms `paymentId` actually belongs to `orderId` before touching it —
   * discovered during review that markReceiptVerified/rejectReceipt looked
   * up the receipt by paymentId alone, so a mismatched (orderId, paymentId)
   * pair would silently verify/reject a *different* order's receipt while
   * firing the state transition on this one.
   */
  private async findReceiptForOrder(orderId: string, paymentId: string) {
    const trx = this.uow.getClient();
    const receipt = await trx
      .selectFrom('receipt')
      .innerJoin('payment', 'payment.id', 'receipt.payment_id')
      .innerJoin('payment_installment', 'payment_installment.id', 'payment.installment_id')
      .innerJoin('payment_plan', 'payment_plan.id', 'payment_installment.payment_plan_id')
      .innerJoin('contract', 'contract.id', 'payment_plan.contract_id')
      .select(['receipt.id as id'])
      .where('receipt.payment_id', '=', paymentId)
      .where('contract.order_id', '=', orderId)
      .executeTakeFirst();
    if (!receipt) throw new NotFoundException(`no receipt found for payment ${paymentId} on order ${orderId}`);
    return receipt;
  }

  async markReceiptVerified(orderId: string, actor: ActorRef, paymentId: string, expectedStateVersion: number) {
    const trx = this.uow.getClient();
    const receipt = await this.findReceiptForOrder(orderId, paymentId);

    await trx
      .updateTable('receipt')
      .set({ verification_status: 'VERIFIED', verified_by: actor.id, verified_at: new Date() })
      .where('id', '=', receipt.id)
      .execute();

    return this.engine.transition({ orderId, event: 'verify_match', actor, expectedStateVersion });
  }

  async rejectReceipt(orderId: string, actor: ActorRef, paymentId: string, reason: string, expectedStateVersion: number) {
    const trx = this.uow.getClient();
    const receipt = await this.findReceiptForOrder(orderId, paymentId);

    await trx
      .updateTable('receipt')
      .set({ verification_status: 'REJECTED', rejection_reason: reason })
      .where('id', '=', receipt.id)
      .execute();

    return this.engine.transition({ orderId, event: 'reject_receipt', actor, expectedStateVersion });
  }

  async escalateReceiptToDispute(orderId: string, actor: ActorRef, expectedStateVersion: number) {
    return this.engine.transition({ orderId, event: 'escalate_to_dispute', actor, expectedStateVersion });
  }

  // ---- dual-confirmation sub-machine (state-machine.md §3) ----

  async supplierAcknowledges(orderId: string, supplierId: string, expectedStateVersion: number) {
    await this.assertSupplierOwnsOrder(orderId, supplierId);
    return this.engine.transition({
      orderId,
      event: 'supplier_acknowledges',
      actor: { role: 'SUPPLIER', id: supplierId },
      expectedStateVersion,
    });
  }

  /** Step 1 of real four-eyes: names a *different* admin who must independently confirm before the transition can fire. */
  async proposeAdminVerification(orderId: string, submitterId: string, approverId: string) {
    return this.financialApproval.propose({
      entityType: 'order',
      entityId: orderId,
      action: SUPPLIER_PAYMENT_VERIFICATION,
      submitterId,
      approverId,
    });
  }

  /**
   * Step 2: only the designated approver calling this (in a separate request,
   * with their own JWT) satisfies four-eyes. On success this is also the
   * atomic financial event: it fires SUPPLIER_PAYMENT_CONFIRMED (locking
   * non-refundability + starting the manufacturing clock — see
   * TransitionEngineService), then best-effort chains identity reveal and
   * routing onward, exactly as state-machine.md §3 describes.
   */
  async approveAdminVerification(orderId: string, approverActor: ActorRef, paymentId: string, expectedStateVersion: number) {
    await this.financialApproval.approve({
      entityType: 'order',
      entityId: orderId,
      action: SUPPLIER_PAYMENT_VERIFICATION,
      approverId: approverActor.id!,
    });

    // Captured BEFORE the state change — buildGuardContext derives
    // isFirstEscrowPayment from financial_commitment_started_at, which the
    // atomic effect below is about to set. Re-reading it after the fact
    // would always see it as already-set and wrongly conclude "not the
    // first payment" on every chained reveal_identity call, including the
    // very first one. This is exactly the kind of ordering bug the atomic
    // event exists to prevent — capture the fact before it stops being true.
    const trx = this.uow.getClient();
    const orderBefore = await trx
      .selectFrom('order')
      .select(['financial_commitment_started_at'])
      .where('id', '=', orderId)
      .executeTakeFirstOrThrow();
    const wasFirstEscrowPayment = orderBefore.financial_commitment_started_at == null;

    const outcome = await this.engine.transition({
      orderId,
      event: 'admin_confirms_with_supplier',
      actor: approverActor,
      expectedStateVersion,
      effect: async (effectTrx) => {
        await effectTrx.updateTable('payment').set({ current_refundability_status: 'LOCKED' }).where('id', '=', paymentId).execute();
      },
    });

    try {
      const revealed = await this.engine.transition({
        orderId,
        event: 'reveal_identity',
        actor: SYSTEM,
        expectedStateVersion: outcome.stateVersion,
        ctxOverrides: { isFirstEscrowPayment: wasFirstEscrowPayment },
      });
      const routed = await this.engine.transition({
        orderId,
        event: 'continue',
        actor: SYSTEM,
        expectedStateVersion: revealed.stateVersion,
        // Harmless if this lands on LOADING_SHIPPING instead (requireNoProductionOversight) — ctx field is simply unused there.
        ctxOverrides: { productionSlaMs: this.config.get('productionSlaMs', { infer: true }) },
      });
      return { outcome, revealed, routed };
    } catch (err) {
      // Only a deny-by-default guard rejection (later/non-first escrow
      // payments, or service types without identity management) is expected
      // here — the order simply stays where it is. Anything else (a real
      // StaleStateError from concurrent modification, a DB error, ...) must
      // NOT be swallowed: discovered during review that a bare `catch {}`
      // here would silently hide a genuine failure and return a false
      // success, leaving the order stuck with no error trail.
      if (err instanceof TransitionRejectedError) {
        return { outcome };
      }
      throw err;
    }
  }

  async verificationFailed(orderId: string, actor: ActorRef, expectedStateVersion: number) {
    return this.engine.transition({ orderId, event: 'verification_failed', actor, expectedStateVersion });
  }
}

function isUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: unknown }).code === '23505';
}
