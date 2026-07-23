import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Kysely } from 'kysely';
import { ActorRef, PermissionAction } from '@apex/domain';
import { KYSELY } from '../database/database.module';
import { DB } from '../database/db.types';
import { UnitOfWork } from '../database/unit-of-work';
import { TransitionEngineService } from '../transition-engine/transition-engine.service';
import { FinancialApprovalService } from '../financial-approval/financial-approval.service';
import { CreateExternalSupplierDto } from './dto/create-external-supplier.dto';

const VETTING_ACTION: PermissionAction = 'EXTERNAL_SUPPLIER_FINAL_APPROVAL';

/**
 * Closes a real gap: `external_supplier` (migrations/1700000000004) and the
 * EXT_VETTING_DOCS approve_vetting/reject_vetting transitions have existed
 * since the beginning, but nothing in apps/api ever created a row or fired
 * either event — an order routed to the external-supplier path got
 * permanently stuck. Follows the exact propose/approve four-eyes pattern
 * already used by payments.service.ts/disputes.service.ts
 * (entityType: 'order', not 'external_supplier' — FinancialApprovalService
 * is keyed by order throughout the codebase, not by the sub-entity id).
 */
@Injectable()
export class ExternalSuppliersService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<DB>,
    private readonly uow: UnitOfWork,
    private readonly engine: TransitionEngineService,
    private readonly financialApproval: FinancialApprovalService,
  ) {}

  async create(orderId: string, dto: CreateExternalSupplierDto) {
    const trx = this.uow.getClient();
    return trx
      .insertInto('external_supplier')
      .values({
        order_id: orderId,
        legal_name: dto.legalName,
        license_number: dto.licenseNumber ?? null,
        years_active: dto.yearsActive ?? null,
        verification_source: dto.verificationSource ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async get(orderId: string) {
    const trx = this.uow.getClient();
    const row = await trx.selectFrom('external_supplier').selectAll().where('order_id', '=', orderId).executeTakeFirst();
    if (!row) throw new NotFoundException(`no external_supplier row for order ${orderId}`);
    return row;
  }

  async proposeApproval(orderId: string, submitterActor: ActorRef, approverId: string) {
    return this.financialApproval.propose({
      entityType: 'order',
      entityId: orderId,
      action: VETTING_ACTION,
      submitterId: submitterActor.id!,
      approverId,
    });
  }

  /** Chains approve_vetting -> continue (SYSTEM) in one call, landing directly on CONTRACT_PAYMENT_PLAN_CREATED — same convention as bidding.service.ts's selectOffer() chaining customer_selects -> continue. */
  async approve(orderId: string, approverActor: ActorRef, expectedStateVersion: number) {
    await this.financialApproval.approve({
      entityType: 'order',
      entityId: orderId,
      action: VETTING_ACTION,
      approverId: approverActor.id!,
    });

    const trx = this.uow.getClient();
    const externalSupplier = await trx.selectFrom('external_supplier').select(['id']).where('order_id', '=', orderId).executeTakeFirst();
    if (!externalSupplier) throw new BadRequestException(`no external_supplier row for order ${orderId}`);

    const approved = await this.engine.transition({
      orderId,
      event: 'approve_vetting',
      actor: approverActor,
      expectedStateVersion,
      effect: async (effectTrx) => {
        await effectTrx
          .updateTable('external_supplier')
          .set({ vetting_status: 'APPROVED', vetted_by: approverActor.id, vetted_at: new Date() })
          .where('id', '=', externalSupplier.id)
          .execute();
      },
    });
    return this.engine.transition({ orderId, event: 'continue', actor: { role: 'SYSTEM', id: null }, expectedStateVersion: approved.stateVersion });
  }

  /** Chains reject_vetting -> auto_close (SYSTEM) in one call — EXT_VETTING_REJECTED is not a state a human acts on separately, exactly like orders.service.ts's reject()/REVIEW_REJECTED. */
  async reject(orderId: string, actor: ActorRef, expectedStateVersion: number) {
    const trx = this.uow.getClient();
    const externalSupplier = await trx.selectFrom('external_supplier').select(['id']).where('order_id', '=', orderId).executeTakeFirst();
    if (!externalSupplier) throw new BadRequestException(`no external_supplier row for order ${orderId}`);

    const rejected = await this.engine.transition({
      orderId,
      event: 'reject_vetting',
      actor,
      expectedStateVersion,
      effect: async (effectTrx) => {
        await effectTrx.updateTable('external_supplier').set({ vetting_status: 'REJECTED' }).where('id', '=', externalSupplier.id).execute();
      },
    });
    await this.engine.transition({ orderId, event: 'auto_close', actor: { role: 'SYSTEM', id: null }, expectedStateVersion: rejected.stateVersion });
    return rejected;
  }
}
