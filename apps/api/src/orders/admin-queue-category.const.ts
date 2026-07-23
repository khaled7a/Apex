import { OrderState } from '@apex/domain';

export type AdminQueueCategory =
  | 'REVIEW'
  | 'VETTING'
  | 'BIDDING'
  | 'PAYMENT_VERIFICATION'
  | 'LOGISTICS'
  | 'CUSTOMS'
  | 'DISPUTE'
  | 'ESCALATION'
  | 'RENEWAL';

/**
 * Cosmetic dashboard grouping ONLY — not a source of authorization. Deliberately
 * narrower than ADMIN_ACTIONABLE_STATES (packages/domain): most PROD_ and CONTRACT_
 * states are technically "admin actionable" only because an admin can always
 * cancel them (admin_cancel_order), which isn't the normal path and would make
 * the "needs your attention now" dashboard mostly noise. This map lists only the
 * states where an admin decision is actually the expected next step.
 * admin-queue-category.spec.ts asserts every key here is a real member of
 * ADMIN_ACTIONABLE_STATES, so this can never silently point at a state with no
 * real admin-only transition.
 */
export const ADMIN_QUEUE_CATEGORY: Partial<Record<OrderState, AdminQueueCategory>> = {
  REVIEW_PENDING: 'REVIEW',
  EXT_VETTING_DOCS: 'VETTING',
  REG_BIDS_EXPIRED_NO_OFFERS: 'BIDDING',
  REG_ADMIN_REVIEW_BIDS: 'BIDDING',
  REG_NO_OFFER_SELECTED: 'BIDDING',
  CONTRACT_RECEIPT_UPLOADED: 'PAYMENT_VERIFICATION',
  CONTRACT_ADMIN_VERIFYING: 'PAYMENT_VERIFICATION',
  CONTRACT_RECEIPT_REJECTED: 'PAYMENT_VERIFICATION',
  PAYMENT_PENDING_ADMIN_VERIFICATION: 'PAYMENT_VERIFICATION',
  LOGISTICS_ONLY_SETUP: 'LOGISTICS',
  LOADING_SHIPPING: 'LOGISTICS',
  SHIPPING_DOCS: 'LOGISTICS',
  IN_TRANSIT: 'LOGISTICS',
  ARRIVED_PORT: 'LOGISTICS',
  CUSTOMS_FEE_ADDED: 'CUSTOMS',
  CUSTOMS_FEE_PROOF_UPLOADED: 'CUSTOMS',
  CUSTOMS_FEE_VERIFIED: 'CUSTOMS',
  DISPUTE_PAYMENT: 'DISPUTE',
  DISPUTE_QUALITY: 'DISPUTE',
  DISPUTE_DELAY: 'DISPUTE',
  DISPUTE_SHIPPING: 'DISPUTE',
  DISPUTE_MANDATORY_REFUND: 'DISPUTE',
  ESCALATION_ESCALATED: 'ESCALATION',
  RENEWAL_SUPPLIER_DECLINED: 'RENEWAL',
  RENEWAL_PENDING_ADMIN: 'RENEWAL',
};
