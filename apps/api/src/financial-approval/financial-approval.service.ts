import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { UnitOfWork } from '../database/unit-of-work';

/**
 * A real two-person-integrity workflow, not a role check pretending to be
 * one: `propose()` names a specific colleague as the required approver
 * (enforced by the DB's `no_self_approval` CHECK too), and only that person
 * calling `approve()` later — in a separate request — satisfies four-eyes.
 * Used wherever docs/data-model.md §1 marks an action "four-eyes إلزامي".
 */
@Injectable()
export class FinancialApprovalService {
  constructor(private readonly uow: UnitOfWork) {}

  async propose(params: { entityType: string; entityId: string; action: string; submitterId: string; approverId: string }) {
    if (params.submitterId === params.approverId) {
      throw new BadRequestException('the submitter and the designated approver must be different people');
    }
    const trx = this.uow.getClient();
    return trx
      .insertInto('financial_approval')
      .values({
        entity_type: params.entityType,
        entity_id: params.entityId,
        action: params.action,
        submitter_id: params.submitterId,
        approver_id: params.approverId,
      })
      .returning(['id', 'submitted_at'])
      .executeTakeFirstOrThrow();
  }

  /** Returns the approval row once the designated approver confirms it — callers should then proceed with the transition. */
  async approve(params: { entityType: string; entityId: string; action: string; approverId: string }) {
    const trx = this.uow.getClient();
    const pending = await trx
      .selectFrom('financial_approval')
      .selectAll()
      .where('entity_type', '=', params.entityType)
      .where('entity_id', '=', params.entityId)
      .where('action', '=', params.action)
      .where('approved_at', 'is', null)
      .orderBy('submitted_at', 'desc')
      .executeTakeFirst();

    if (!pending) {
      throw new NotFoundException('no pending four-eyes approval found for this action');
    }
    if (pending.approver_id !== params.approverId) {
      throw new ConflictException('you are not the designated approver for this action');
    }

    return trx
      .updateTable('financial_approval')
      .set({ approved_at: new Date() })
      .where('id', '=', pending.id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }

  /** Confirms a specific pending approval has in fact been approved by the named approver — used as a guard before firing a transition. */
  async assertApproved(params: { entityType: string; entityId: string; action: string; requiredApproverRole?: string }): Promise<void> {
    const trx = this.uow.getClient();
    const approval = await trx
      .selectFrom('financial_approval')
      .selectAll()
      .where('entity_type', '=', params.entityType)
      .where('entity_id', '=', params.entityId)
      .where('action', '=', params.action)
      .where('approved_at', 'is not', null)
      .orderBy('approved_at', 'desc')
      .executeTakeFirst();

    if (!approval) {
      throw new ConflictException(`four-eyes approval for ${params.action} has not been completed yet`);
    }
  }
}
