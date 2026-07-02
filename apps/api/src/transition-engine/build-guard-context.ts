import { GuardContext, OrderState } from '@apex/domain';
import { Transaction } from 'kysely';
import { DB } from '../database/db.types';

/**
 * Reads the order row (already locked FOR UPDATE by the caller) plus its
 * service_type, and assembles the base GuardContext. Module-specific fields
 * (offerCount, escalationActor, isFirstEscrowPayment override, ...) are
 * merged in by the caller via `ctxOverrides` — this function only knows
 * about columns that live directly on `order`/`service_type`.
 */
export async function buildGuardContext(
  trx: Transaction<DB>,
  order: {
    id: string;
    current_state: OrderState;
    service_type_id: string;
    supplier_type: 'REGISTERED' | 'EXTERNAL' | 'NONE';
    hold_type: 'NONE' | 'ESCALATION' | 'DISPUTE';
    financial_commitment_started_at: Date | string | null;
    resume_target_state: string | null;
  },
): Promise<GuardContext> {
  const serviceType = await trx
    .selectFrom('service_type')
    .select(['includes_sourcing', 'includes_identity_management', 'includes_production_oversight'])
    .where('id', '=', order.service_type_id)
    .executeTakeFirstOrThrow();

  return {
    orderId: order.id,
    currentState: order.current_state,
    serviceType: {
      includesSourcing: serviceType.includes_sourcing,
      includesIdentityManagement: serviceType.includes_identity_management,
      includesProductionOversight: serviceType.includes_production_oversight,
    },
    supplierType: order.supplier_type,
    hasActiveDispute: order.hold_type === 'DISPUTE',
    hasEverConfirmedSupplierPayment: order.financial_commitment_started_at != null,
    isFirstEscrowPayment: order.financial_commitment_started_at == null,
    resumeTargetState: (order.resume_target_state as OrderState | null) ?? undefined,
  };
}
