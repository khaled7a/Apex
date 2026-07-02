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

export function isDisputeState(state: OrderState): boolean {
  return DISPUTE_STATES.includes(state);
}

export function isEscalationState(state: OrderState): boolean {
  return ESCALATION_STATES.includes(state);
}

export function isHoldState(state: OrderState): boolean {
  return isDisputeState(state) || isEscalationState(state);
}
