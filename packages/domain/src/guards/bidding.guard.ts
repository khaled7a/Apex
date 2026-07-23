import { Guard } from '../states/transition.types';

export const requireAtLeastOneOffer: Guard = {
  name: 'requireAtLeastOneOffer',
  check: (ctx) =>
    (ctx.offerCount ?? 0) >= 1 ? { ok: true } : { ok: false, reason: 'no offers received before deadline' },
};

export const requireNoOffers: Guard = {
  name: 'requireNoOffers',
  check: (ctx) =>
    (ctx.offerCount ?? 0) === 0 ? { ok: true } : { ok: false, reason: 'offers already exist' },
};
