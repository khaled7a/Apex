import { Kysely } from 'kysely';
import { ActorRef } from '@apex/domain';
import { DB } from './db.types';
import { UnitOfWork } from './unit-of-work';
import { setActorSessionVars } from './db-actor';

/**
 * Background workers (the timer scheduler, future queue consumers) have no
 * HTTP request to hang a transaction off of — this is their equivalent of
 * DbTransactionInterceptor: one transaction, actor session vars set, then
 * UnitOfWork so every repository call inside `fn` shares it.
 */
export async function runSystemTransaction<T>(
  db: Kysely<DB>,
  uow: UnitOfWork,
  actor: ActorRef,
  fn: () => Promise<T>,
): Promise<T> {
  return db.transaction().execute(async (trx) => {
    await setActorSessionVars(trx, actor);
    return uow.run(trx, fn);
  });
}
