import { describe, expect, it } from 'vitest';
import { ADMIN_ACTIONABLE_STATES, isAdminActionableState } from './admin-queue.helper';
import { OrderState } from './order-states.const';

/**
 * Pins the exact set derived from TRANSITIONS as of this writing — a
 * regression guard against silent drift (e.g. someone widens allowedRoles
 * on a customer/supplier row to include an admin role by accident, or
 * removes an admin escape hatch without noticing the queue shrinks).
 * Re-derive by hand against transitions.table.ts if this test ever needs
 * updating — do not just copy the actual output back in.
 */
const EXPECTED_ADMIN_ACTIONABLE_STATES: readonly OrderState[] = [
  'REVIEW_PENDING',
  'EXT_VETTING_DOCS',
  'REG_BIDS_EXPIRED_NO_OFFERS',
  'REG_ADMIN_REVIEW_BIDS',
  'REG_NO_OFFER_SELECTED',
  'CONTRACT_PAYMENT_PLAN_CREATED',
  'CONTRACT_SIGNED',
  'CONTRACT_BANK_TRANSFER_DONE',
  'CONTRACT_RECEIPT_UPLOADED',
  'CONTRACT_ADMIN_VERIFYING',
  'CONTRACT_RECEIPT_REJECTED',
  'PAYMENT_PENDING_SUPPLIER_ACK',
  'PAYMENT_PENDING_ADMIN_VERIFICATION',
  'SUPPLIER_PAYMENT_CONFIRMED',
  'IDENTITY_REVEALED',
  'PROD_DESIGN_SUBMITTED',
  'PROD_CHECKPOINT_1',
  'PROD_CHECKPOINT_1_REJECTED',
  'PROD_FULL_PRODUCTION',
  'PROD_QC_SUBMITTED',
  'PROD_CHECKPOINT_2',
  'PROD_CHECKPOINT_2_REJECTED',
  'LOGISTICS_ONLY_SETUP',
  'LOADING_SHIPPING',
  'SHIPPING_DOCS',
  'IN_TRANSIT',
  'ARRIVED_PORT',
  'CUSTOMS_FEE_ADDED',
  'CUSTOMS_FEE_PROOF_UPLOADED',
  'CUSTOMS_FEE_VERIFIED',
  'DISPUTE_PAYMENT',
  'DISPUTE_QUALITY',
  'DISPUTE_DELAY',
  'DISPUTE_SHIPPING',
  'DISPUTE_MANDATORY_REFUND',
  'ESCALATION_ESCALATED',
  'RENEWAL_SUPPLIER_DECLINED',
  'RENEWAL_PENDING_ADMIN',
];

describe('ADMIN_ACTIONABLE_STATES', () => {
  it('matches the pinned expected set exactly', () => {
    expect([...ADMIN_ACTIONABLE_STATES].sort()).toEqual([...EXPECTED_ADMIN_ACTIONABLE_STATES].sort());
  });

  it('excludes states that are only actionable by customer/supplier/system', () => {
    const notActionable: OrderState[] = [
      'DRAFT',
      'ESCALATION_REMINDER', // waiting on customer/supplier response or a timeout, not admin
      'CUSTOMS_CUSTOMER_PAYS', // waiting on the customer to pay
      'AGREEMENT_CANCELLED_PENDING_RENEWAL', // waiting on the customer to request renewal
      'RENEWAL_PENDING_SUPPLIER', // waiting on the supplier
      'FINAL_DELIVERY',
      'CUSTOMER_SIGNED',
      'COMPLETED',
      'CANCELLED',
    ];
    for (const state of notActionable) {
      expect(isAdminActionableState(state)).toBe(false);
    }
  });

  it('includes representative states from every admin-facing sub-flow', () => {
    const shouldBeActionable: OrderState[] = [
      'REVIEW_PENDING',
      'EXT_VETTING_DOCS',
      'REG_ADMIN_REVIEW_BIDS',
      'PAYMENT_PENDING_ADMIN_VERIFICATION',
      'CUSTOMS_FEE_ADDED',
      'DISPUTE_MANDATORY_REFUND',
      'ESCALATION_ESCALATED',
      'RENEWAL_PENDING_ADMIN',
    ];
    for (const state of shouldBeActionable) {
      expect(isAdminActionableState(state)).toBe(true);
    }
  });
});
