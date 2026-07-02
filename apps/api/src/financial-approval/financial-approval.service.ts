import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  ActorRole,
  PermissionAction,
  approverRoleMustDifferFromSubmitter,
  isFinalApproverRoleAllowed,
} from '@apex/domain';
import { UnitOfWork } from '../database/unit-of-work';

/**
 * A real two-person-integrity workflow, not a role check pretending to be
 * one: `propose()` names a specific colleague as the required approver
 * (enforced by the DB's `no_self_approval` CHECK too), and only that person
 * calling `approve()` later — in a separate request — satisfies four-eyes.
 * Used wherever docs/data-model.md §1 marks an action "four-eyes إلزامي".
 *
 * This is also the ONLY place a four-eyes role restriction (e.g. "OPERATOR
 * may propose, only ACCOUNTANT/OWNER may finally approve") is enforced —
 * discovered during review that payments.service.ts had zero role check on
 * the approver, silently allowing two OPERATORs to jointly lock a payment
 * that docs/data-model.md §1 reserves for ACCOUNTANT/OWNER. Reading the
 * matrix directly here (instead of each caller hand-rolling its own role
 * check, as disputes.service.ts used to) means the check can never drift
 * out of sync with PERMISSION_MATRIX again.
 */
@Injectable()
export class FinancialApprovalService {
  constructor(private readonly uow: UnitOfWork) {}

  async getAdminRole(adminId: string): Promise<ActorRole> {
    const trx = this.uow.getClient();
    const admin = await trx.selectFrom('admin_user').select(['role']).where('id', '=', adminId).executeTakeFirst();
    if (!admin) throw new NotFoundException(`admin ${adminId} not found`);
    return `ADMIN_${admin.role}` as ActorRole;
  }

  async propose(params: { entityType: string; entityId: string; action: PermissionAction; submitterId: string; approverId: string }) {
    if (params.submitterId === params.approverId) {
      throw new BadRequestException('the submitter and the designated approver must be different people');
    }

    const approverRole = await this.getAdminRole(params.approverId);
    if (!isFinalApproverRoleAllowed(params.action, approverRole)) {
      throw new BadRequestException(`the designated approver (role ${approverRole}) is not permitted to give final approval for ${params.action}`);
    }
    if (approverRoleMustDifferFromSubmitter(params.action)) {
      const submitterRole = await this.getAdminRole(params.submitterId);
      if (submitterRole === approverRole) {
        throw new BadRequestException(`${params.action} requires the approver to hold a different role than the submitter (both were ${submitterRole})`);
      }
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
  async approve(params: { entityType: string; entityId: string; action: PermissionAction; approverId: string }) {
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

    // Re-checked at approval time too (not just at propose()) as defense in
    // depth — e.g. if the matrix changes, or an admin's role is demoted,
    // between the two requests.
    const approverRole = await this.getAdminRole(params.approverId);
    if (!isFinalApproverRoleAllowed(params.action, approverRole)) {
      throw new ForbiddenException(`role ${approverRole} is not permitted to give final approval for ${params.action}`);
    }

    return trx
      .updateTable('financial_approval')
      .set({ approved_at: new Date() })
      .where('id', '=', pending.id)
      .returningAll()
      .executeTakeFirstOrThrow();
  }
}
