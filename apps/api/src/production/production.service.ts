import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kysely } from 'kysely';
import { ActorRef } from '@apex/domain';
import { KYSELY } from '../database/database.module';
import { DB } from '../database/db.types';
import { UnitOfWork } from '../database/unit-of-work';
import { TransitionEngineService } from '../transition-engine/transition-engine.service';
import { UploadProductionUpdateDto } from './dto/upload-production-update.dto';
import { RejectCheckpointDto } from './dto/reject-checkpoint.dto';
import { AppConfig } from '../config/configuration';

const SYSTEM: ActorRef = { role: 'SYSTEM', id: null };

@Injectable()
export class ProductionService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<DB>,
    private readonly uow: UnitOfWork,
    private readonly engine: TransitionEngineService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  private async postUpdate(orderId: string, postedByRole: 'SUPPLIER' | 'CUSTOMER', dto: UploadProductionUpdateDto) {
    const trx = this.uow.getClient();
    await trx
      .insertInto('production_update')
      .values({ order_id: orderId, kind: dto.kind, content: dto.content ?? null, file_url: dto.fileUrl ?? null, posted_by: postedByRole })
      .execute();
  }

  private get productionSlaMs(): number {
    return this.config.get('productionSlaMs', { infer: true });
  }

  async uploadDesign(orderId: string, supplierId: string, dto: UploadProductionUpdateDto) {
    await this.postUpdate(orderId, 'SUPPLIER', dto);
    return this.engine.transition({
      orderId,
      event: 'supplier_uploads_design',
      actor: { role: 'SUPPLIER', id: supplierId },
      expectedStateVersion: dto.expectedStateVersion,
      ctxOverrides: { productionSlaMs: this.productionSlaMs },
    });
  }

  /** Chains the SYSTEM-only `continue` immediately — PROD_QC_SUBMITTED has no independent business decision attached to it, same rationale as OrdersService.approveAndRoute's chaining. */
  async uploadQc(orderId: string, supplierId: string, dto: UploadProductionUpdateDto) {
    await this.postUpdate(orderId, 'SUPPLIER', dto);
    const uploaded = await this.engine.transition({
      orderId,
      event: 'supplier_uploads_qc',
      actor: { role: 'SUPPLIER', id: supplierId },
      expectedStateVersion: dto.expectedStateVersion,
    });
    return this.engine.transition({
      orderId,
      event: 'continue',
      actor: SYSTEM,
      expectedStateVersion: uploaded.stateVersion,
      ctxOverrides: { productionSlaMs: this.productionSlaMs },
    });
  }

  /** `customer_approves` is shared by PROD_CHECKPOINT_1 and PROD_CHECKPOINT_2 — computeTransition disambiguates by current_state, so one method covers both. */
  async approve(orderId: string, actor: ActorRef, expectedStateVersion: number) {
    return this.engine.transition({ orderId, event: 'customer_approves', actor, expectedStateVersion, ctxOverrides: { productionSlaMs: this.productionSlaMs } });
  }

  async reject(orderId: string, actor: ActorRef, dto: RejectCheckpointDto) {
    return this.engine.transition({
      orderId,
      event: 'customer_rejects_explicit',
      actor,
      expectedStateVersion: dto.expectedStateVersion,
      payload: { reason: dto.reason },
    });
  }

  /** Which resubmit event fires depends on which checkpoint was rejected — mirrors PaymentsService.uploadReceipt's upload_receipt/reupload_receipt pattern. */
  async resubmit(orderId: string, supplierId: string, dto: UploadProductionUpdateDto) {
    const trx = this.uow.getClient();
    const order = await trx.selectFrom('order').select(['current_state']).where('id', '=', orderId).executeTakeFirstOrThrow();
    const event = order.current_state === 'PROD_CHECKPOINT_2_REJECTED' ? 'supplier_resubmits_qc' : 'supplier_resubmits';

    await this.postUpdate(orderId, 'SUPPLIER', dto);
    return this.engine.transition({
      orderId,
      event,
      actor: { role: 'SUPPLIER', id: supplierId },
      expectedStateVersion: dto.expectedStateVersion,
      ctxOverrides: { productionSlaMs: this.productionSlaMs },
    });
  }
}
