import { CallHandler, ExecutionContext, ForbiddenException, Inject, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { Kysely } from 'kysely';
import { KYSELY } from './database.module';
import { DB } from './db.types';
import { UnitOfWork } from './unit-of-work';
import { setActorSessionVars } from './db-actor';
import { RequestWithActor } from '../auth/request-with-actor';
import { IS_PUBLIC_KEY } from '../auth/decorators/public.decorator';

/**
 * Opens exactly one DB transaction per HTTP request, sets the RLS session
 * variables for whatever actor the upstream auth guard resolved, and runs
 * the rest of the request inside UnitOfWork so every repository call in this
 * request shares that same transaction/connection. Commits on success, rolls
 * back on any thrown error (including a rejected transition) — this is the
 * one and only place a DB transaction boundary is opened for a request.
 *
 * Fails closed when no actor is present: discovered during review that this
 * used to silently default to `{ role: 'SYSTEM' }` (ADMIN-equivalent RLS
 * access) whenever an auth guard was missing or failed to set request.actor
 * — a fail-open gap for any future route added without a guard. Background
 * workers never go through this interceptor at all (see
 * runSystemTransaction), so SYSTEM has no legitimate reason to originate
 * from an HTTP request; the only routes that legitimately have no
 * authenticated actor (health check, dev token issuance) opt out explicitly
 * via @Public().
 */
@Injectable()
export class DbTransactionInterceptor implements NestInterceptor {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<DB>,
    private readonly uow: UnitOfWork,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithActor>();
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    const actor = request.actor ?? (isPublic ? { role: 'SYSTEM' as const, id: null } : undefined);

    if (!actor) {
      throw new ForbiddenException('no authenticated actor resolved for this request');
    }

    return from(
      this.db.transaction().execute(async (trx) => {
        await setActorSessionVars(trx, actor);
        return this.uow.run(trx, () => firstValueFrom(next.handle(), { defaultValue: undefined }));
      }),
    );
  }
}
