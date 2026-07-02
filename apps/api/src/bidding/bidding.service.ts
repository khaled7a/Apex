import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Kysely } from 'kysely';
import { ActorRef } from '@apex/domain';
import { KYSELY } from '../database/database.module';
import { DB } from '../database/db.types';
import { UnitOfWork } from '../database/unit-of-work';
import { TransitionEngineService } from '../transition-engine/transition-engine.service';
import { SubmitOfferDto } from './dto/submit-offer.dto';
import { ReviewBidsDto } from './dto/review-bids.dto';

const SYSTEM: ActorRef = { role: 'SYSTEM', id: null };

@Injectable()
export class BiddingService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<DB>,
    private readonly uow: UnitOfWork,
    private readonly engine: TransitionEngineService,
  ) {}

  /** Fires the closed-bidding self-loop event; RLS on `offer` is what actually enforces isolation between suppliers. */
  async submitOffer(orderId: string, supplierId: string, dto: SubmitOfferDto) {
    const trx = this.uow.getClient();
    const order = await trx.selectFrom('order').select(['state_version']).where('id', '=', orderId).executeTakeFirst();
    if (!order) throw new NotFoundException(`order ${orderId} not found`);

    await trx
      .insertInto('offer')
      .values({
        order_id: orderId,
        registered_supplier_id: supplierId,
        fob_value_usd: dto.fobValueUsd,
        lead_time_days: dto.leadTimeDays,
        terms: dto.terms,
      })
      .execute();

    // Self-loop: does not change current_state, but is still an auditable event.
    return this.engine.transition({
      orderId,
      event: 'submit_offer',
      actor: { role: 'SUPPLIER', id: supplierId },
      expectedStateVersion: order.state_version,
    });
  }

  /** RLS on `offer` guarantees this only ever returns the calling supplier's own rows. */
  async listMyOffers(orderId: string) {
    const trx = this.uow.getClient();
    return trx.selectFrom('offer').selectAll().where('order_id', '=', orderId).execute();
  }

  async reviewBids(orderId: string, actor: ActorRef, dto: ReviewBidsDto) {
    const trx = this.uow.getClient();
    const offers = await trx.selectFrom('offer').selectAll().where('order_id', '=', orderId).execute();
    if (offers.length === 0) {
      throw new BadRequestException('cannot review bids with zero offers');
    }

    await trx
      .updateTable('order')
      .set({
        fx_rate_used: dto.fxRateUsed,
        fx_rate_source: dto.fxRateSource,
        fx_rate_entered_by: actor.role.startsWith('ADMIN') ? actor.id : null,
        low_competition_offer: offers.length === 1,
      })
      .where('id', '=', orderId)
      .execute();

    return this.engine.transition({
      orderId,
      event: 'approve_offers',
      actor,
      expectedStateVersion: dto.expectedStateVersion,
    });
  }

  async rejectAllOffers(orderId: string, actor: ActorRef, expectedStateVersion: number) {
    return this.engine.transition({ orderId, event: 'customer_rejects_all', actor, expectedStateVersion });
  }

  async republish(orderId: string, actor: ActorRef, expectedStateVersion: number) {
    return this.engine.transition({ orderId, event: 'republish', actor, expectedStateVersion });
  }

  async selectOffer(orderId: string, actor: ActorRef, offerId: string, expectedStateVersion: number) {
    const trx = this.uow.getClient();
    const offer = await trx
      .selectFrom('offer')
      .selectAll()
      .where('id', '=', offerId)
      .where('order_id', '=', orderId)
      .executeTakeFirst();
    if (!offer) throw new NotFoundException(`offer ${offerId} not found on order ${orderId}`);

    const order = await trx
      .selectFrom('order')
      .select(['fx_rate_used'])
      .where('id', '=', orderId)
      .executeTakeFirstOrThrow();
    if (!order.fx_rate_used) {
      throw new BadRequestException('fx_rate_used has not been set yet — offers must be reviewed first');
    }

    const finalValueSar = Number(offer.fob_value_usd) * Number(order.fx_rate_used);

    await trx
      .updateTable('order')
      .set({
        registered_supplier_id: offer.registered_supplier_id,
        fob_value_usd: offer.fob_value_usd,
        final_value_sar: finalValueSar.toFixed(2),
      })
      .where('id', '=', orderId)
      .execute();

    let version = expectedStateVersion;
    await this.engine.transition({ orderId, event: 'customer_selects', actor, expectedStateVersion: version });
    version += 1;
    return this.engine.transition({ orderId, event: 'continue', actor: SYSTEM, expectedStateVersion: version });
  }
}
