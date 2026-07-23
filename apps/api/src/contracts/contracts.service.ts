import { randomUUID } from 'node:crypto';
import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Kysely } from 'kysely';
import { ActorRef } from '@apex/domain';
import { KYSELY } from '../database/database.module';
import { DB } from '../database/db.types';
import { UnitOfWork } from '../database/unit-of-work';
import { TransitionEngineService } from '../transition-engine/transition-engine.service';
import { CreatePaymentPlanDto } from './dto/create-payment-plan.dto';

@Injectable()
export class ContractsService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<DB>,
    private readonly uow: UnitOfWork,
    private readonly engine: TransitionEngineService,
  ) {}

  /**
   * Data-only — does not move current_state (the order is already sitting in
   * CONTRACT_PAYMENT_PLAN_CREATED, having arrived there via the engine).
   * Manual per-order plan authoring, exactly as docs/state-machine.md §3
   * requires ("لا قالب موحّد").
   */
  async createPaymentPlan(orderId: string, adminId: string, dto: CreatePaymentPlanDto) {
    const trx = this.uow.getClient();
    const order = await trx.selectFrom('order').select(['id', 'current_state']).where('id', '=', orderId).executeTakeFirst();
    if (!order) throw new NotFoundException(`order ${orderId} not found`);
    if (order.current_state !== 'CONTRACT_PAYMENT_PLAN_CREATED') {
      throw new BadRequestException(`order is at ${order.current_state}, not CONTRACT_PAYMENT_PLAN_CREATED`);
    }

    let contract = await trx.selectFrom('contract').selectAll().where('order_id', '=', orderId).executeTakeFirst();
    if (!contract) {
      contract = await trx
        .insertInto('contract')
        .values({ order_id: orderId, terms_snapshot: JSON.stringify({}) })
        .returningAll()
        .executeTakeFirstOrThrow();
    }

    const plan = await trx
      .insertInto('payment_plan')
      .values({ contract_id: contract.id, created_by: adminId, total_installments: dto.installments.length })
      .returningAll()
      .executeTakeFirstOrThrow();

    const installments = [];
    for (const [index, item] of dto.installments.entries()) {
      const installment = await trx
        .insertInto('payment_installment')
        .values({
          payment_plan_id: plan.id,
          sequence_no: index + 1,
          label: item.label,
          expected_amount_sar: item.expectedAmountSar,
          is_trust_fund: item.isTrustFund,
          refund_policy: item.refundPolicy,
          unique_payment_reference: `UPR-${orderId.slice(0, 8)}-${index + 1}-${randomUUID().slice(0, 8)}`,
          due_stage: item.dueStage ?? null,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      installments.push(installment);
    }

    return { contract, plan, installments };
  }

  async signContract(orderId: string, actor: ActorRef, expectedStateVersion: number, signatureRef: string) {
    const trx = this.uow.getClient();
    await trx.updateTable('contract').set({ signed_at: new Date(), signature_ref: signatureRef }).where('order_id', '=', orderId).execute();
    return this.engine.transition({ orderId, event: 'sign_contract', actor, expectedStateVersion });
  }
}
