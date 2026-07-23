import { ActorRef, ActorRole } from '@apex/domain';
import { Transaction } from 'kysely';
import { sql } from 'kysely';
import { DB } from './db.types';

export type DbActorType = 'ADMIN' | 'CUSTOMER' | 'SUPPLIER' | 'SYSTEM';

/**
 * The domain layer distinguishes OWNER/OPERATOR/ACCOUNTANT (for the
 * permission matrix); RLS policies only need the coarser ADMIN bucket — a
 * logged-in admin of any sub-role sees everything, per docs/schema.sql's
 * RLS design (fine-grained admin permission checks happen in the
 * PermissionMatrixGuard, not at the row-visibility layer).
 */
export function toDbActorType(role: ActorRole): DbActorType {
  switch (role) {
    case 'CUSTOMER':
      return 'CUSTOMER';
    case 'SUPPLIER':
      return 'SUPPLIER';
    case 'ADMIN_OWNER':
    case 'ADMIN_OPERATOR':
    case 'ADMIN_ACCOUNTANT':
      return 'ADMIN';
    case 'SYSTEM':
      return 'SYSTEM';
  }
}

/**
 * Sets the two session variables every RLS policy in
 * migrations/*_rls-policies.sql reads. Uses `set_config(...)` rather than a
 * literal `SET LOCAL x = ...` statement specifically so the values can be
 * bound as ordinary query parameters instead of being string-interpolated
 * into the SQL text — `SET` does not accept bind parameters in Postgres's
 * wire protocol, but a plain function call like `set_config` does.
 */
export async function setActorSessionVars(trx: Transaction<DB>, actor: ActorRef): Promise<void> {
  const dbActorType = toDbActorType(actor.role);
  await sql`SELECT set_config('app.actor_type', ${dbActorType}, true)`.execute(trx);
  await sql`SELECT set_config('app.actor_id', ${actor.id ?? ''}, true)`.execute(trx);
}
