import { OrderState } from '@apex/domain';

const DISPUTE_STATES: readonly OrderState[] = [
  'DISPUTE_PAYMENT',
  'DISPUTE_QUALITY',
  'DISPUTE_DELAY',
  'DISPUTE_SHIPPING',
  'DISPUTE_MANDATORY_REFUND',
  'DISPUTE_RESOLVED',
];

const ESCALATION_STATES: readonly OrderState[] = ['ESCALATION_REMINDER', 'ESCALATION_ESCALATED'];

export const DISPUTE_TYPE_BY_STATE: Partial<Record<OrderState, string>> = {
  DISPUTE_PAYMENT: 'PAYMENT',
  DISPUTE_QUALITY: 'QUALITY',
  DISPUTE_DELAY: 'DELAY',
  DISPUTE_SHIPPING: 'SHIPPING',
  DISPUTE_MANDATORY_REFUND: 'MANDATORY_REFUND',
};

/**
 * Which party is being escalated is a property of the EVENT that entered
 * ESCALATION_REMINDER (customer_sla_expired vs supplier_sla_expired), not of
 * the destination state — both land on the same ESCALATION_REMINDER/
 * ESCALATION_ESCALATED states regardless of who is being chased. Mirrors
 * DISPUTE_TYPE_BY_STATE's role, just keyed by event instead of state.
 */
export const ESCALATION_ACTOR_BY_EVENT: Record<string, 'CUSTOMER_APPROVAL' | 'SUPPLIER_DELIVERABLE'> = {
  customer_sla_expired: 'CUSTOMER_APPROVAL',
  supplier_sla_expired: 'SUPPLIER_DELIVERABLE',
};

export function isDisputeState(state: OrderState): boolean {
  return DISPUTE_STATES.includes(state);
}

export function isEscalationState(state: OrderState): boolean {
  return ESCALATION_STATES.includes(state);
}

export function isHoldState(state: OrderState): boolean {
  return isDisputeState(state) || isEscalationState(state);
}
