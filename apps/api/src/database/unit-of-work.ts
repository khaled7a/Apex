import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import { Transaction } from 'kysely';
import { DB } from './db.types';

interface UnitOfWorkStore {
  trx: Transaction<DB>;
}

/**
 * Every repository/service reads the CURRENT request's transaction through
 * this instead of holding a reference to a pooled Kysely instance directly —
 * that is what guarantees `SET LOCAL app.actor_type/app.actor_id` (set once
 * per request by DbTransactionInterceptor) stays in effect for every query
 * that request makes, because they all share the same underlying connection.
 */
@Injectable()
export class UnitOfWork {
  private readonly als = new AsyncLocalStorage<UnitOfWorkStore>();

  run<T>(trx: Transaction<DB>, fn: () => Promise<T>): Promise<T> {
    return this.als.run({ trx }, fn);
  }

  getClient(): Transaction<DB> {
    const store = this.als.getStore();
    if (!store) {
      throw new Error(
        'UnitOfWork.getClient() called outside of a request transaction context — ' +
          'every DB-touching code path must run inside DbTransactionInterceptor.',
      );
    }
    return store.trx;
  }
}
