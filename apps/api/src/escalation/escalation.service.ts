import { Injectable } from '@nestjs/common';
import { ActorRef } from '@apex/domain';
import { TransitionEngineService } from '../transition-engine/transition-engine.service';

/**
 * `escalationActor` is resolved automatically by build-guard-context.ts from
 * order.active_escalation_id — no ctxOverrides needed here, unlike offerCount
 * or biddingDeadlineMs which are genuinely caller-supplied.
 */
@Injectable()
export class EscalationService {
  constructor(private readonly engine: TransitionEngineService) {}

  async customerResponds(orderId: string, customerId: string, expectedStateVersion: number) {
    return this.engine.transition({
      orderId,
      event: 'customer_responds',
      actor: { role: 'CUSTOMER', id: customerId },
      expectedStateVersion,
    });
  }

  async supplierResponds(orderId: string, supplierId: string, expectedStateVersion: number) {
    return this.engine.transition({
      orderId,
      event: 'supplier_responds',
      actor: { role: 'SUPPLIER', id: supplierId },
      expectedStateVersion,
    });
  }

  /** ADMIN_OWNER_ONLY at the domain layer — a non-owner admin gets a 422 ROLE_NOT_ALLOWED from computeTransition itself, no separate permission-matrix entry needed for this admin-judgment action. */
  async customerNoResponseFinal(orderId: string, actor: ActorRef, expectedStateVersion: number) {
    return this.engine.transition({ orderId, event: 'customer_no_response_final', actor, expectedStateVersion });
  }

  async supplierNoResponseFinal(orderId: string, actor: ActorRef, expectedStateVersion: number) {
    return this.engine.transition({ orderId, event: 'supplier_no_response_final', actor, expectedStateVersion });
  }
}
