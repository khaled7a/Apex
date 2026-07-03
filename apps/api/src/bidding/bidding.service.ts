import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kysely } from 'kysely';
import { ActorRef, isActionAllowed } from '@apex/domain';
import { KYSELY } from '../database/database.module';
import { DB } from '../database/db.types';
import { UnitOfWork } from '../database/unit-of-work';
import { TransitionEngineService } from '../transition-engine/transition-engine.service';
import { SubmitOfferDto } from './dto/submit-offer.dto';
import { ReviewBidsDto } from './dto/review-bids.dto';
import { AppConfig } from '../config/configuration';

const SYSTEM: ActorRef = { role: 'SYSTEM', id: null };

@Injectable()
export class BiddingService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<DB>,
    private readonly uow: UnitOfWork,
    private readonly engine: TransitionEngineService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  /**
   * `bidding_board` (migrations/1700000000018_rls-policies.sql) was created
   * specifically for this — a narrow, customer-identity-free projection of
   * open orders — but nothing ever queried it: a supplier had no way to
   * discover an orderId to bid on at all before this endpoint existed.
   */
  async listBiddingBoard() {
    const trx = this.uow.getClient();
    return trx
      .selectFrom('bidding_board')
      .innerJoin('service_type', 'service_type.id', 'bidding_board.service_type_id')
      .select(['bidding_board.order_id', 'service_type.label_ar as serviceTypeLabel', 'bidding_board.fob_value_usd', 'bidding_board.created_at'])
      .orderBy('bidding_board.created_at', 'desc')
      .execute();
  }

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

  /**
   * Anonymized offer comparison for the customer — deliberately never
   * selects registered_supplier_id or legal_name (docs/schema.sql: the
   * supplier's real identity stays concealed until IDENTITY_REVEALED, well
   * after this step). state-machine.md's REG_SHOWN_TO_CUSTOMER row still
   * calls this "كشف مبدئي: اسم المورد وتقييماته" (initial name+rating
   * disclosure), but that predates the identity-concealment column comment
   * on registered_supplier.legal_name — resolved conservatively in favor of
   * the stronger, more specific security guarantee an anonymized position
   * label ("Supplier 1"/"Supplier 2"), not the real company name.
   */
  async listOffersForCustomer(orderId: string) {
    const order = await this.uow.getClient().selectFrom('order').select(['current_state']).where('id', '=', orderId).executeTakeFirst();
    if (!order) throw new NotFoundException(`order ${orderId} not found`);
    if (!['REG_SHOWN_TO_CUSTOMER', 'REG_CUSTOMER_SELECTS', 'REG_NO_OFFER_SELECTED'].includes(order.current_state)) {
      throw new BadRequestException('offers are not shown to the customer yet at this order state');
    }

    const trx = this.uow.getClient();
    const offers = await trx
      .selectFrom('offer')
      .select(['id', 'fob_value_usd', 'lead_time_days', 'terms', 'submitted_at'])
      .where('order_id', '=', orderId)
      .orderBy('submitted_at', 'asc')
      .execute();

    return offers.map((offer, index) => ({ ...offer, supplierLabel: `المورد ${index + 1}` }));
  }

  async reviewBids(orderId: string, actor: ActorRef, dto: ReviewBidsDto) {
    const trx = this.uow.getClient();
    const offers = await trx.selectFrom('offer').selectAll().where('order_id', '=', orderId).execute();
    if (offers.length === 0) {
      throw new BadRequestException('cannot review bids with zero offers');
    }

    // fx_rate_deviation_flag was documented in docs/data-model.md §1 as a
    // required tripwire ("انحراف > حد معيّن عن سعر مرجعي ⇒ يتطلب اعتماد OWNER
    // إضافي") but discovered during review to be entirely unimplemented — a
    // single OPERATOR could enter any fx_rate_used with zero oversight. Now
    // computed for real against an independently supplied reference rate.
    const deviationRatio = Math.abs(dto.fxRateUsed - dto.fxReferenceRate) / dto.fxReferenceRate;
    const deviationFlag = deviationRatio > this.config.get('fxDeviationThresholdPct', { infer: true });

    await trx
      .updateTable('order')
      .set({
        fx_rate_used: dto.fxRateUsed,
        fx_rate_source: dto.fxRateSource,
        fx_rate_entered_by: isActionAllowed('OFFER_APPROVAL_AND_FX_RATE_ENTRY', actor.role) ? actor.id : null,
        low_competition_offer: offers.length === 1,
        fx_rate_deviation_flag: deviationFlag,
        fx_rate_deviation_approved_by: null,
        fx_rate_deviation_approved_at: null,
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

  /** The extra OWNER sign-off docs/data-model.md §1 requires before a flagged (deviating) fx rate can be used to select an offer. */
  async approveFxDeviation(orderId: string, actor: ActorRef) {
    if (actor.role !== 'ADMIN_OWNER') {
      throw new ForbiddenException('only ADMIN_OWNER may approve an fx rate deviation');
    }
    const trx = this.uow.getClient();
    const order = await trx.selectFrom('order').select(['fx_rate_deviation_flag']).where('id', '=', orderId).executeTakeFirstOrThrow();
    if (!order.fx_rate_deviation_flag) {
      throw new BadRequestException('this order has no flagged fx rate deviation to approve');
    }
    await trx
      .updateTable('order')
      .set({ fx_rate_deviation_approved_by: actor.id, fx_rate_deviation_approved_at: new Date() })
      .where('id', '=', orderId)
      .execute();
    return { approved: true };
  }

  async rejectAllOffers(orderId: string, actor: ActorRef, expectedStateVersion: number) {
    return this.engine.transition({ orderId, event: 'customer_rejects_all', actor, expectedStateVersion });
  }

  async republish(orderId: string, actor: ActorRef, expectedStateVersion: number) {
    return this.engine.transition({ orderId, event: 'republish', actor, expectedStateVersion });
  }

  /**
   * REG_BIDS_EXPIRED_NO_OFFERS had `extend_deadline`/`cancel_order` rows in
   * the transition table from the start, but nothing in apps/api ever fired
   * either event — an order that timed out with zero bids was permanently
   * stuck with no controller action able to move it. Re-opens the same
   * bidding window (schedulesTimer on this row re-reads biddingDeadlineMs).
   */
  async extendDeadline(orderId: string, actor: ActorRef, expectedStateVersion: number) {
    return this.engine.transition({
      orderId,
      event: 'extend_deadline',
      actor,
      expectedStateVersion,
      ctxOverrides: { biddingDeadlineMs: this.config.get('biddingDeadlineMs', { infer: true }) },
    });
  }

  /**
   * Covers both REG_BIDS_EXPIRED_NO_OFFERS and REG_NO_OFFER_SELECTED — the
   * engine looks up the row by (fromState, event), so one endpoint serves
   * both dead-end source states without needing to know which one it's in.
   */
  async cancel(orderId: string, actor: ActorRef, expectedStateVersion: number) {
    return this.engine.transition({ orderId, event: 'cancel_order', actor, expectedStateVersion });
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
      .select(['fx_rate_used', 'fx_rate_deviation_flag', 'fx_rate_deviation_approved_at'])
      .where('id', '=', orderId)
      .executeTakeFirstOrThrow();
    if (!order.fx_rate_used) {
      throw new BadRequestException('fx_rate_used has not been set yet — offers must be reviewed first');
    }
    if (order.fx_rate_deviation_flag && !order.fx_rate_deviation_approved_at) {
      throw new BadRequestException('fx_rate_used deviates from the reference rate beyond the allowed threshold — requires an additional OWNER approval before an offer can be selected');
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

    const selected = await this.engine.transition({ orderId, event: 'customer_selects', actor, expectedStateVersion });
    return this.engine.transition({ orderId, event: 'continue', actor: SYSTEM, expectedStateVersion: selected.stateVersion });
  }
}
