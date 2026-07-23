import { GuardContext } from '../states/transition.types';
import { OrderState } from '../states/order-states.const';

export function makeCtx(overrides: Partial<GuardContext> & { currentState: OrderState }): GuardContext {
  return {
    orderId: 'test-order-1',
    serviceType: {
      includesSourcing: true,
      includesIdentityManagement: true,
      includesProductionOversight: true,
    },
    supplierType: 'REGISTERED',
    hasActiveDispute: false,
    hasEverConfirmedSupplierPayment: false,
    isFirstEscrowPayment: true,
    ...overrides,
  };
}
