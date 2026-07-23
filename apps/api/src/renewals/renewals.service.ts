import { Inject, Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { ActorRef } from '@apex/domain';
import { KYSELY } from '../database/database.module';
import { DB } from '../database/db.types';
import { UnitOfWork } from '../database/unit-of-work';
import { TransitionEngineService } from '../transition-engine/transition-engine.service';

@Injectable()
export class RenewalsService {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<DB>,
    private readonly uow: UnitOfWork,
    private readonly engine: TransitionEngineService,
  ) {}

  /** The most recent renewal row for this order — the one still in progress, since a new request_renewal only fires after the prior round fully resolved (approved/declined+resolved). */
  private async latestRenewal(orderId: string) {
    return this.uow
      .getClient()
      .selectFrom('agreement_renewal')
      .selectAll()
      .where('order_id', '=', orderId)
      .orderBy('requested_at', 'desc')
      .executeTakeFirstOrThrow();
  }

  async requestRenewal(orderId: string, customerId: string, expectedStateVersion: number) {
    const trx = this.uow.getClient();
    const previous = await trx
      .selectFrom('agreement_renewal')
      .select(['id'])
      .where('order_id', '=', orderId)
      .orderBy('requested_at', 'desc')
      .executeTakeFirst();

    await trx
      .insertInto('agreement_renewal')
      .values({ order_id: orderId, renewal_of_agreement_id: previous?.id ?? null })
      .execute();

    return this.engine.transition({
      orderId,
      event: 'request_renewal',
      actor: { role: 'CUSTOMER', id: customerId },
      expectedStateVersion,
    });
  }

  async supplierApproves(orderId: string, supplierId: string, expectedStateVersion: number) {
    const renewal = await this.latestRenewal(orderId);
    await this.uow
      .getClient()
      .updateTable('agreement_renewal')
      .set({ supplier_decision: 'APPROVED', supplier_decided_at: new Date() })
      .where('id', '=', renewal.id)
      .execute();

    return this.engine.transition({
      orderId,
      event: 'supplier_approves',
      actor: { role: 'SUPPLIER', id: supplierId },
      expectedStateVersion,
    });
  }

  async supplierDeclines(orderId: string, supplierId: string, expectedStateVersion: number) {
    const renewal = await this.latestRenewal(orderId);
    await this.uow
      .getClient()
      .updateTable('agreement_renewal')
      .set({ supplier_decision: 'DECLINED', supplier_decided_at: new Date() })
      .where('id', '=', renewal.id)
      .execute();

    return this.engine.transition({
      orderId,
      event: 'supplier_declines',
      actor: { role: 'SUPPLIER', id: supplierId },
      expectedStateVersion,
    });
  }

  /** ADMIN_APPROVAL_ROLES (OWNER/OPERATOR) is already enforced by the domain layer's allowedRoles — a non-approval admin gets a 422 from computeTransition itself. */
  async pickAlternateSupplier(orderId: string, actor: ActorRef, expectedStateVersion: number) {
    return this.engine.transition({ orderId, event: 'pick_alternate_supplier', actor, expectedStateVersion });
  }

  async customerPrefersFullCancel(orderId: string, customerId: string, expectedStateVersion: number) {
    return this.engine.transition({
      orderId,
      event: 'customer_prefers_full_cancel',
      actor: { role: 'CUSTOMER', id: customerId },
      expectedStateVersion,
    });
  }

  async adminApproves(orderId: string, actor: ActorRef, expectedStateVersion: number) {
    const renewal = await this.latestRenewal(orderId);
    await this.uow
      .getClient()
      .updateTable('agreement_renewal')
      .set({ admin_decision: 'APPROVED', admin_decided_by: actor.id, admin_decided_at: new Date() })
      .where('id', '=', renewal.id)
      .execute();

    return this.engine.transition({ orderId, event: 'admin_approves', actor, expectedStateVersion });
  }

  /** No 'REJECTED' value in the renewal_decision enum (PENDING/APPROVED/DECLINED) — a rejection is recorded as DECLINED, same as a supplier decline. */
  async adminRejects(orderId: string, actor: ActorRef, expectedStateVersion: number) {
    const renewal = await this.latestRenewal(orderId);
    await this.uow
      .getClient()
      .updateTable('agreement_renewal')
      .set({ admin_decision: 'DECLINED', admin_decided_by: actor.id, admin_decided_at: new Date() })
      .where('id', '=', renewal.id)
      .execute();

    return this.engine.transition({ orderId, event: 'admin_rejects', actor, expectedStateVersion });
  }
}
