import { Guard } from '../states/transition.types';

export const requireSourcingEnabled: Guard = {
  name: 'requireSourcingEnabled',
  check: (ctx) =>
    ctx.serviceType.includesSourcing
      ? { ok: true }
      : { ok: false, reason: 'service_type does not include sourcing' },
};

export const requireSourcingDisabled: Guard = {
  name: 'requireSourcingDisabled',
  check: (ctx) =>
    !ctx.serviceType.includesSourcing
      ? { ok: true }
      : { ok: false, reason: 'service_type includes sourcing, cannot route to logistics-only' },
};

export const requireProductionOversight: Guard = {
  name: 'requireProductionOversight',
  check: (ctx) =>
    ctx.serviceType.includesProductionOversight
      ? { ok: true }
      : { ok: false, reason: 'service_type does not include production oversight' },
};

export const requireNoProductionOversight: Guard = {
  name: 'requireNoProductionOversight',
  check: (ctx) =>
    !ctx.serviceType.includesProductionOversight
      ? { ok: true }
      : { ok: false, reason: 'service_type includes production oversight' },
};

export const requireIdentityManagementAndFirstPayment: Guard = {
  name: 'requireIdentityManagementAndFirstPayment',
  check: (ctx) => {
    if (!ctx.serviceType.includesIdentityManagement) {
      return { ok: false, reason: 'service_type does not include identity management' };
    }
    if (!ctx.isFirstEscrowPayment) {
      return { ok: false, reason: 'identity reveal only fires on the first escrow payment' };
    }
    return { ok: true };
  },
};

export function requireSupplierType(type: 'REGISTERED' | 'EXTERNAL'): Guard {
  return {
    name: `requireSupplierType(${type})`,
    check: (ctx) =>
      ctx.supplierType === type ? { ok: true } : { ok: false, reason: `supplier_type is not ${type}` },
  };
}
