import { Inject, Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { ActorRef } from '@apex/domain';
import { KYSELY } from '../database/database.module';
import { DB } from '../database/db.types';
import { UnitOfWork } from '../database/unit-of-work';
import { TransitionEngineService } from '../transition-engine/transition-engine.service';
import { RateSupplierDto } from './dto/rate-supplier.dto';

const SYSTEM: ActorRef = { role: 'SYSTEM', id: null };

@Injectable()
export class RatingsService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<DB>,
    private readonly uow: UnitOfWork,
    private readonly engine: TransitionEngineService,
  ) {}

  async customerSigns(orderId: string, customerId: string, expectedStateVersion: number) {
    return this.engine.transition({
      orderId,
      event: 'customer_signs',
      actor: { role: 'CUSTOMER', id: customerId },
      expectedStateVersion,
    });
  }

  /** Records the rating, fires rate_supplier, then chains the terminal SYSTEM `close` to COMPLETED in the same request — SUPPLIER_RATED has no independent business decision attached to it, same rationale as every other auto-chained SYSTEM step in this codebase. */
  async rateSupplier(orderId: string, customerId: string, dto: RateSupplierDto) {
    const trx = this.uow.getClient();
    const order = await trx
      .selectFrom('order')
      .select(['supplier_type', 'registered_supplier_id', 'external_supplier_id'])
      .where('id', '=', orderId)
      .executeTakeFirstOrThrow();

    await trx
      .insertInto('supplier_rating')
      .values({
        order_id: orderId,
        supplier_type: order.supplier_type,
        registered_supplier_id: order.supplier_type === 'REGISTERED' ? order.registered_supplier_id : null,
        external_supplier_id: order.supplier_type === 'EXTERNAL' ? order.external_supplier_id : null,
        phase: 'POST_CONTRACT',
        rated_by: customerId,
        score: dto.score,
        notes: dto.notes ?? null,
      })
      .execute();

    const rated = await this.engine.transition({
      orderId,
      event: 'rate_supplier',
      actor: { role: 'CUSTOMER', id: customerId },
      expectedStateVersion: dto.expectedStateVersion,
    });
    return this.engine.transition({ orderId, event: 'close', actor: SYSTEM, expectedStateVersion: rated.stateVersion });
  }
}
