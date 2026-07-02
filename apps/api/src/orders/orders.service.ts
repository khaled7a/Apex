import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kysely } from 'kysely';
import { ActorRef } from '@apex/domain';
import { KYSELY } from '../database/database.module';
import { DB } from '../database/db.types';
import { UnitOfWork } from '../database/unit-of-work';
import { TransitionEngineService } from '../transition-engine/transition-engine.service';
import { ApproveOrderDto } from './dto/approve-order.dto';
import { AppConfig } from '../config/configuration';

const SYSTEM: ActorRef = { role: 'SYSTEM', id: null };

@Injectable()
export class OrdersService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<DB>,
    private readonly uow: UnitOfWork,
    private readonly engine: TransitionEngineService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  async createDraft(customerId: string, serviceTypeCode: string) {
    const trx = this.uow.getClient();
    const serviceType = await trx
      .selectFrom('service_type')
      .select(['id'])
      .where('code', '=', serviceTypeCode)
      .executeTakeFirst();
    if (!serviceType) {
      throw new NotFoundException(`unknown service type code: ${serviceTypeCode}`);
    }
    return trx
      .insertInto('order')
      .values({ customer_id: customerId, service_type_id: serviceType.id })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async get(orderId: string) {
    const trx = this.uow.getClient();
    const order = await trx.selectFrom('order').selectAll().where('id', '=', orderId).executeTakeFirst();
    if (!order) throw new NotFoundException(`order ${orderId} not found`);
    return order;
  }

  async submit(orderId: string, actor: ActorRef, expectedStateVersion: number) {
    return this.engine.transition({ orderId, event: 'submit', actor, expectedStateVersion });
  }

  /**
   * v1 simplification: the deposit is a fixed, non-refundable, admin-verified
   * bank transfer, but is not yet modeled as a full Payment/Receipt row the
   * way trust-fund installments are (PaymentPlan/PaymentInstallment only
   * exist from CONTRACT_PAYMENT_PLAN_CREATED onward — there is currently no
   * home for a payment that happens before any PaymentPlan exists). A v2
   * follow-up should introduce a plan-less "standalone payment" record so
   * the deposit gets the same receipt-fingerprint/audit treatment as every
   * other payment instead of being a bare state transition.
   */
  async confirmDeposit(orderId: string, expectedStateVersion: number) {
    return this.engine.transition({ orderId, event: 'deposit_paid', actor: SYSTEM, expectedStateVersion });
  }

  async requestEdit(orderId: string, actor: ActorRef, expectedStateVersion: number) {
    return this.engine.transition({ orderId, event: 'request_edit', actor, expectedStateVersion });
  }

  async resubmit(orderId: string, actor: ActorRef, expectedStateVersion: number) {
    return this.engine.transition({ orderId, event: 'resubmit', actor, expectedStateVersion });
  }

  async reject(orderId: string, actor: ActorRef, expectedStateVersion: number) {
    const rejected = await this.engine.transition({ orderId, event: 'reject', actor, expectedStateVersion });
    await this.engine.transition({ orderId, event: 'auto_close', actor: SYSTEM, expectedStateVersion: rejected.stateVersion });
    return rejected;
  }

  /**
   * Approves the order, records the admin's supplier-sourcing decision, and
   * chains the two SYSTEM-only transitions (REVIEW_APPROVED -> SUPPLIER_CHOICE
   * -> route) in the same request/transaction, since neither is a distinct
   * business decision a human needs to act on separately.
   */
  async approveAndRoute(orderId: string, actor: ActorRef, dto: ApproveOrderDto) {
    const trx = this.uow.getClient();
    const order = await trx.selectFrom('order').selectAll().where('id', '=', orderId).executeTakeFirstOrThrow();
    const serviceType = await trx
      .selectFrom('service_type')
      .selectAll()
      .where('id', '=', order.service_type_id)
      .executeTakeFirstOrThrow();

    let supplierType: 'REGISTERED' | 'EXTERNAL' | 'NONE' = 'NONE';
    if (serviceType.includes_sourcing) {
      if (!dto.supplierType) {
        throw new BadRequestException('supplierType is required because this service type includes sourcing');
      }
      supplierType = dto.supplierType;
      if (supplierType === 'EXTERNAL' && !dto.externalSupplierId) {
        throw new BadRequestException('externalSupplierId is required when supplierType is EXTERNAL');
      }
    } else if (dto.supplierType) {
      throw new BadRequestException('this service type does not include sourcing — supplierType must be omitted');
    }

    await trx
      .updateTable('order')
      .set({
        supplier_type: supplierType,
        external_supplier_id: supplierType === 'EXTERNAL' ? (dto.externalSupplierId ?? null) : null,
      })
      .where('id', '=', orderId)
      .execute();

    const approved = await this.engine.transition({ orderId, event: 'approve', actor, expectedStateVersion: dto.expectedStateVersion });
    const continued = await this.engine.transition({
      orderId,
      event: 'continue',
      actor: SYSTEM,
      expectedStateVersion: approved.stateVersion,
    });
    const routed = await this.engine.transition({
      orderId,
      event: 'route',
      actor: SYSTEM,
      expectedStateVersion: continued.stateVersion,
    });

    // REG_PUBLISHED has no independent business decision attached to it in
    // v1 (the "open broadcast, no category gate" decision means publishing
    // is automatic the instant routing lands here) — chain it in the same
    // request rather than requiring a separate admin click.
    if (routed.toState === 'REG_PUBLISHED') {
      return this.engine.transition({
        orderId,
        event: 'auto_publish',
        actor: SYSTEM,
        expectedStateVersion: routed.stateVersion,
        ctxOverrides: { biddingDeadlineMs: this.config.get('biddingDeadlineMs', { infer: true }) },
      });
    }
    return routed;
  }
}
