import { Guard, GuardContext, GuardResult } from '../states/transition.types';

export function allOf(name: string, guards: readonly Guard[]): Guard {
  return {
    name,
    check: (ctx: GuardContext): GuardResult => {
      for (const g of guards) {
        const result = g.check(ctx);
        if (!result.ok) return { ok: false, reason: `${g.name}: ${result.reason}` };
      }
      return { ok: true };
    },
  };
}
