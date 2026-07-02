import { Injectable } from '@nestjs/common';
import { sql } from 'kysely';
import { UnitOfWork } from '../database/unit-of-work';

export interface AuditLogEntry {
  entityType: string;
  entityId: string;
  action: string;
  actorId: string | null;
  actorRole: string;
  stateBefore?: unknown;
  stateAfter?: unknown;
}

/**
 * INSERT-only by design — mirrors the DB-level REVOKE UPDATE/DELETE on
 * audit_log (migrations/*_audit-log.sql). There is deliberately no update()
 * or delete() method on this service; it would be a lie, since the DB would
 * reject it anyway.
 */
@Injectable()
export class AuditLogService {
  constructor(private readonly uow: UnitOfWork) {}

  async write(entry: AuditLogEntry): Promise<void> {
    const trx = this.uow.getClient();
    await trx
      .insertInto('audit_log')
      .values({
        entity_type: entry.entityType,
        entity_id: entry.entityId,
        action: entry.action,
        actor_id: entry.actorId,
        actor_role: entry.actorRole,
        state_before: entry.stateBefore != null ? JSON.stringify(entry.stateBefore) : null,
        state_after: entry.stateAfter != null ? JSON.stringify(entry.stateAfter) : null,
        // record_hash/prev_hash/occurred_at are all overwritten by
        // trg_audit_log_chain_hash (BEFORE INSERT) regardless of what is
        // passed here — this placeholder only satisfies the NOT NULL type.
        record_hash: '',
      })
      .execute();
  }

  /**
   * Recomputes the hash chain and reports the first row (if any) where it
   * breaks — proof the append-only guarantee holds. This intentionally
   * recomputes hashes *in SQL* using the exact same expression as
   * `trg_audit_log_chain_hash`, rather than reconstructing Postgres's
   * `::text` casting and JSONB key-ordering rules in JavaScript, which would
   * silently diverge from what the trigger actually produced (timestamp
   * text format and jsonb-to-text key ordering are Postgres-specific and
   * are not the same as `Date#toISOString()` / `JSON.stringify()`).
   */
  async verifyChainIntegrity(): Promise<{ intact: boolean; brokenAtId: string | null }> {
    const trx = this.uow.getClient();
    const result = await sql<{ id: string }>`
      WITH ordered AS (
        SELECT id, entity_type, entity_id, action, actor_id, state_before, state_after,
               occurred_at, prev_hash, record_hash,
               LAG(record_hash) OVER (ORDER BY id) AS expected_prev_hash
        FROM audit_log
      )
      SELECT id FROM ordered
      WHERE prev_hash IS DISTINCT FROM expected_prev_hash
         OR record_hash IS DISTINCT FROM encode(
              digest(
                COALESCE(expected_prev_hash, '') || entity_type || entity_id::text || action ||
                COALESCE(actor_id::text, '') || COALESCE(state_before::text, '') ||
                COALESCE(state_after::text, '') || occurred_at::text,
                'sha256'
              ),
              'hex'
            )
      ORDER BY id
      LIMIT 1
    `.execute(trx);

    const brokenRow = result.rows[0];
    return brokenRow ? { intact: false, brokenAtId: brokenRow.id } : { intact: true, brokenAtId: null };
  }
}
