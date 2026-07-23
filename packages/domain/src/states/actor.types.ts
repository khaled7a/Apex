/**
 * Actor roles as understood by the domain layer. Distinct admin sub-roles
 * are first-class (not a generic 'ADMIN') because the permission matrix in
 * docs/data-model.md §1 draws hard lines between them — collapsing them
 * would make it impossible to express "OPERATOR starts, ACCOUNTANT approves"
 * four-eyes rules at the type level.
 */
export type ActorRole =
  | 'CUSTOMER'
  | 'SUPPLIER'
  | 'ADMIN_OWNER'
  | 'ADMIN_OPERATOR'
  | 'ADMIN_ACCOUNTANT'
  | 'SYSTEM';

export interface ActorRef {
  role: ActorRole;
  id: string | null; // null only for SYSTEM
}

export const ANY_ADMIN: readonly ActorRole[] = ['ADMIN_OWNER', 'ADMIN_OPERATOR', 'ADMIN_ACCOUNTANT'];
export const ADMIN_APPROVAL_ROLES: readonly ActorRole[] = ['ADMIN_OWNER', 'ADMIN_OPERATOR'];
export const ADMIN_OWNER_ONLY: readonly ActorRole[] = ['ADMIN_OWNER'];
