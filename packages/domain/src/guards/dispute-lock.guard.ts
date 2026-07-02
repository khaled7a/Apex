import { Guard } from '../states/transition.types';

/**
 * Defense in depth alongside the DB-level `one_open_dispute_per_order`
 * unique index (docs/schema.sql) — reject at the domain layer too, so a
 * unit test can prove the rule without touching a database.
 */
export const requireNoActiveDispute: Guard = {
  name: 'requireNoActiveDispute',
  check: (ctx) =>
    ctx.hasActiveDispute
      ? { ok: false, reason: 'an open dispute already exists for this order' }
      : { ok: true },
};
