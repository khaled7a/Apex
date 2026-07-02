import { CallHandler, ExecutionContext, Inject, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, from } from 'rxjs';
import { firstValueFrom } from 'rxjs';
import { Kysely } from 'kysely';
import { KYSELY } from './database.module';
import { DB } from './db.types';
import { UnitOfWork } from './unit-of-work';
import { setActorSessionVars } from './db-actor';
import { RequestWithActor } from '../auth/request-with-actor';

/**
 * Opens exactly one DB transaction per HTTP request, sets the RLS session
 * variables for whatever actor the upstream auth guard resolved, and runs
 * the rest of the request inside UnitOfWork so every repository call in this
 * request shares that same transaction/connection. Commits on success, rolls
 * back on any thrown error (including a rejected transition) — this is the
 * one and only place a DB transaction boundary is opened for a request.
 */
@Injectable()
export class DbTransactionInterceptor implements NestInterceptor {
  constructor(
    @Inject(KYSELY) private readonly db: Kysely<DB>,
    private readonly uow: UnitOfWork,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestWithActor>();
    const actor = request.actor ?? { role: 'SYSTEM' as const, id: null };

    return from(
      this.db.transaction().execute(async (trx) => {
        await setActorSessionVars(trx, actor);
        return this.uow.run(trx, () => firstValueFrom(next.handle(), { defaultValue: undefined }));
      }),
    );
  }
}
