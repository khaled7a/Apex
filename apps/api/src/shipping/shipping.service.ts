import { Inject, Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { ActorRef } from '@apex/domain';
import { KYSELY } from '../database/database.module';
import { DB } from '../database/db.types';
import { UnitOfWork } from '../database/unit-of-work';
import { TransitionEngineService } from '../transition-engine/transition-engine.service';
import { AddShippingDocumentDto } from './dto/add-shipping-document.dto';

const SYSTEM: ActorRef = { role: 'SYSTEM', id: null };

@Injectable()
export class ShippingService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<DB>,
    private readonly uow: UnitOfWork,
    private readonly engine: TransitionEngineService,
  ) {}

  /** For service types with no sourcing/production (requireSourcingDisabled routed here directly from SUPPLIER_CHOICE). */
  async completeLogisticsSetup(orderId: string, actor: ActorRef, expectedStateVersion: number) {
    return this.engine.transition({ orderId, event: 'setup_complete', actor, expectedStateVersion });
  }

  async advanceToDocs(orderId: string, actor: ActorRef, expectedStateVersion: number) {
    return this.engine.transition({ orderId, event: 'continue', actor, expectedStateVersion });
  }

  /** Plain insert, no transition — an order can accumulate several shipping documents (bill of lading, certificates, ...) before the admin finalizes with finalizeDocsUploaded(). */
  async addDocument(orderId: string, actor: ActorRef, dto: AddShippingDocumentDto) {
    const trx = this.uow.getClient();
    return trx
      .insertInto('shipping_document')
      .values({ order_id: orderId, doc_type: dto.docType, file_url: dto.fileUrl, uploaded_by: actor.id })
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  async finalizeDocsUploaded(orderId: string, actor: ActorRef, expectedStateVersion: number) {
    return this.engine.transition({ orderId, event: 'docs_uploaded', actor, expectedStateVersion });
  }

  /**
   * v1-simplification, same as OrdersService.confirmDeposit: remaining
   * payment installments are settled outside this vertical slice's scope
   * (no per-installment four-eyes has been requested for this step), so an
   * admin confirming settlement fires this SYSTEM-role event directly rather
   * than through a dedicated payment-verification sub-flow.
   */
  async confirmInstallments(orderId: string, expectedStateVersion: number) {
    return this.engine.transition({ orderId, event: 'installment_confirmed', actor: SYSTEM, expectedStateVersion });
  }

  async markArrived(orderId: string, actor: ActorRef, expectedStateVersion: number) {
    return this.engine.transition({ orderId, event: 'arrived', actor, expectedStateVersion });
  }
}
