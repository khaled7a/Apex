import { ADMIN_APPROVAL_ROLES, ADMIN_OWNER_ONLY, ANY_ADMIN } from './actor.types';
import { OrderState } from './order-states.const';
import { DisputeType, TransitionRow } from './transition.types';
import {
  requireIdentityManagementAndFirstPayment,
  requireNoProductionOversight,
  requireProductionOversight,
  requireSourcingDisabled,
  requireSourcingEnabled,
  requireSupplierType,
} from '../guards/service-type.guard';
import { requireNoActiveDispute } from '../guards/dispute-lock.guard';
import { requireAtLeastOneOffer, requireNoOffers } from '../guards/bidding.guard';
import { requireEscalationActor } from '../guards/escalation.guard';

const CUSTOMER_OR_SUPPLIER_OR_ADMIN = ['CUSTOMER', 'SUPPLIER', ...ANY_ADMIN] as const;

/**
 * Generates the "open a dispute" rows shared by every disputable phase
 * (state-machine.md §7) instead of hand-typing dozens of near-identical rows —
 * same data, generated instead of copy-pasted, so there is no drift between
 * one occurrence and the next.
 */
function openDisputeRows(fromStates: readonly OrderState[], event: string, to: OrderState): TransitionRow[] {
  return fromStates.map((from) => ({
    from,
    event,
    allowedRoles: CUSTOMER_OR_SUPPLIER_OR_ADMIN,
    guards: [requireNoActiveDispute],
    to,
  }));
}

const DISPUTE_STATES: readonly OrderState[] = [
  'DISPUTE_PAYMENT',
  'DISPUTE_QUALITY',
  'DISPUTE_DELAY',
  'DISPUTE_SHIPPING',
];

/** Generates "resolve -> resume exact frozen point" and "unresolved -> CANCELLED" rows for one dispute type. */
function disputeResolutionRows(from: OrderState): TransitionRow[] {
  return [
    {
      from,
      event: 'admin_resolves_dispute',
      allowedRoles: ADMIN_OWNER_ONLY,
      to: from, // placeholder; overridden by resolveDynamicTarget
      resolveDynamicTarget: (ctx) => ctx.resumeTargetState ?? from,
    },
    {
      from,
      event: 'admin_marks_unresolved',
      allowedRoles: ADMIN_OWNER_ONLY,
      forceMandatoryRefundIfEverConfirmed: true,
      to: 'CANCELLED',
    },
  ];
}

const CONTRACT_PAYMENT_DISPUTE_SOURCES: readonly OrderState[] = [
  'CONTRACT_SIGNED',
  'CONTRACT_BANK_TRANSFER_DONE',
  'CONTRACT_RECEIPT_UPLOADED',
  'CONTRACT_ADMIN_VERIFYING',
];

const PRODUCTION_STATES: readonly OrderState[] = [
  'PROD_DESIGN_SUBMITTED',
  'PROD_CHECKPOINT_1',
  'PROD_CHECKPOINT_1_REJECTED',
  'PROD_FULL_PRODUCTION',
  'PROD_QC_SUBMITTED',
  'PROD_CHECKPOINT_2',
  'PROD_CHECKPOINT_2_REJECTED',
];

const CUSTOMS_STATES: readonly OrderState[] = [
  'CUSTOMS_FEE_ADDED',
  'CUSTOMS_CUSTOMER_PAYS',
  'CUSTOMS_FEE_PROOF_UPLOADED',
  'CUSTOMS_FEE_VERIFIED',
];

/**
 * Generic administrative cancellation, usable from any of the post-contract
 * resting states. `forceMandatoryRefundIfEverConfirmed` (state-machine.md §5)
 * means this is safe to expose everywhere: if a trust-fund payment was ever
 * confirmed, computeTransition redirects this to DISPUTE_MANDATORY_REFUND
 * instead of a silent, undisputed CANCELLED — the rule applies regardless of
 * *why* the admin is cancelling (renewal fallout, buyer's remorse, etc.).
 */
function adminCancelRows(fromStates: readonly OrderState[]): TransitionRow[] {
  return fromStates.map((from) => ({
    from,
    event: 'admin_cancel_order',
    allowedRoles: ADMIN_OWNER_ONLY,
    forceMandatoryRefundIfEverConfirmed: true,
    to: 'CANCELLED' as const,
  }));
}

/**
 * The full transition table — the single source of truth, copied row for
 * row from docs/state-machine.md §2-§7 (post-fix). Any transition not
 * listed here is rejected by computeTransition() (deny-by-default).
 */
export const TRANSITIONS: readonly TransitionRow[] = [
  // ---- §2: submission through supplier choice ----
  { from: 'DRAFT', event: 'submit', allowedRoles: ['CUSTOMER'], to: 'SUBMITTED' },
  { from: 'SUBMITTED', event: 'deposit_paid', allowedRoles: ['SYSTEM'], to: 'REVIEW_PENDING' },
  { from: 'REVIEW_PENDING', event: 'request_edit', allowedRoles: ADMIN_APPROVAL_ROLES, to: 'REVIEW_NEEDS_EDIT' },
  { from: 'REVIEW_NEEDS_EDIT', event: 'resubmit', allowedRoles: ['CUSTOMER'], to: 'REVIEW_PENDING' },
  { from: 'REVIEW_PENDING', event: 'approve', allowedRoles: ADMIN_APPROVAL_ROLES, to: 'REVIEW_APPROVED' },
  { from: 'REVIEW_APPROVED', event: 'continue', allowedRoles: ['SYSTEM'], to: 'SUPPLIER_CHOICE' },
  { from: 'REVIEW_PENDING', event: 'reject', allowedRoles: ADMIN_APPROVAL_ROLES, to: 'REVIEW_REJECTED' },
  // [إصلاح] Rejected was a dead end with no exit.
  { from: 'REVIEW_REJECTED', event: 'auto_close', allowedRoles: ['SYSTEM'], to: 'CANCELLED' },

  // [إصلاح] service_type now actually gates the state machine via guards.
  {
    from: 'SUPPLIER_CHOICE',
    event: 'route',
    allowedRoles: ['SYSTEM'],
    guards: [requireSourcingDisabled],
    to: 'LOGISTICS_ONLY_SETUP',
  },
  {
    from: 'SUPPLIER_CHOICE',
    event: 'route',
    allowedRoles: ['SYSTEM'],
    guards: [requireSourcingEnabled, requireSupplierType('EXTERNAL')],
    to: 'EXT_VETTING_DOCS',
  },
  {
    from: 'SUPPLIER_CHOICE',
    event: 'route',
    allowedRoles: ['SYSTEM'],
    guards: [requireSourcingEnabled, requireSupplierType('REGISTERED')],
    to: 'REG_PUBLISHED',
  },

  // ---- External supplier path ----
  { from: 'EXT_VETTING_DOCS', event: 'approve_vetting', allowedRoles: ADMIN_OWNER_ONLY, to: 'EXT_VETTING_APPROVED' },
  { from: 'EXT_VETTING_DOCS', event: 'reject_vetting', allowedRoles: ADMIN_OWNER_ONLY, to: 'EXT_VETTING_REJECTED' },
  { from: 'EXT_VETTING_APPROVED', event: 'continue', allowedRoles: ['SYSTEM'], to: 'CONTRACT_PAYMENT_PLAN_CREATED' },
  { from: 'EXT_VETTING_REJECTED', event: 'auto_close', allowedRoles: ['SYSTEM'], to: 'CANCELLED' },

  // ---- Registered supplier path (closed bidding) ----
  // Decision: open broadcast, no category gate (docs/state-machine.md §2 note).
  {
    from: 'REG_PUBLISHED',
    event: 'auto_publish',
    allowedRoles: ['SYSTEM'],
    to: 'REG_BIDS_COLLECTING',
    schedulesTimer: (ctx) => ({ type: 'BIDDING_DEADLINE', delayMs: ctx.biddingDeadlineMs ?? 72 * 60 * 60 * 1000 }),
  },
  { from: 'REG_BIDS_COLLECTING', event: 'submit_offer', allowedRoles: ['SUPPLIER'], to: 'REG_BIDS_COLLECTING' },
  {
    from: 'REG_BIDS_COLLECTING',
    event: 'deadline_reached',
    allowedRoles: ['SYSTEM'],
    guards: [requireAtLeastOneOffer],
    to: 'REG_ADMIN_REVIEW_BIDS',
    cancelsTimers: ['BIDDING_DEADLINE'],
  },
  // [إصلاح] deadline with zero offers now has an explicit landing state.
  {
    from: 'REG_BIDS_COLLECTING',
    event: 'deadline_reached',
    allowedRoles: ['SYSTEM'],
    guards: [requireNoOffers],
    to: 'REG_BIDS_EXPIRED_NO_OFFERS',
    cancelsTimers: ['BIDDING_DEADLINE'],
  },
  {
    from: 'REG_BIDS_EXPIRED_NO_OFFERS',
    event: 'extend_deadline',
    allowedRoles: ADMIN_APPROVAL_ROLES,
    to: 'REG_BIDS_COLLECTING',
    schedulesTimer: (ctx) => ({ type: 'BIDDING_DEADLINE', delayMs: ctx.biddingDeadlineMs ?? 72 * 60 * 60 * 1000 }),
  },
  { from: 'REG_BIDS_EXPIRED_NO_OFFERS', event: 'cancel_order', allowedRoles: ADMIN_OWNER_ONLY, to: 'CANCELLED' },
  {
    from: 'REG_ADMIN_REVIEW_BIDS',
    event: 'approve_offers',
    allowedRoles: ADMIN_APPROVAL_ROLES,
    to: 'REG_SHOWN_TO_CUSTOMER',
  },
  { from: 'REG_SHOWN_TO_CUSTOMER', event: 'customer_selects', allowedRoles: ['CUSTOMER'], to: 'REG_CUSTOMER_SELECTS' },
  // [إصلاح] customer rejecting every offer now has an explicit landing state.
  {
    from: 'REG_SHOWN_TO_CUSTOMER',
    event: 'customer_rejects_all',
    allowedRoles: ['CUSTOMER'],
    to: 'REG_NO_OFFER_SELECTED',
  },
  { from: 'REG_NO_OFFER_SELECTED', event: 'republish', allowedRoles: ADMIN_APPROVAL_ROLES, to: 'REG_PUBLISHED' },
  { from: 'REG_NO_OFFER_SELECTED', event: 'cancel_order', allowedRoles: ADMIN_OWNER_ONLY, to: 'CANCELLED' },
  {
    from: 'REG_CUSTOMER_SELECTS',
    event: 'continue',
    allowedRoles: ['SYSTEM'],
    to: 'CONTRACT_PAYMENT_PLAN_CREATED',
  },

  // ---- §3: contract & first payment ----
  {
    from: 'CONTRACT_PAYMENT_PLAN_CREATED',
    event: 'sign_contract',
    allowedRoles: ['CUSTOMER'],
    to: 'CONTRACT_SIGNED',
  },
  { from: 'CONTRACT_SIGNED', event: 'notify_transfer', allowedRoles: ['CUSTOMER'], to: 'CONTRACT_BANK_TRANSFER_DONE' },
  {
    from: 'CONTRACT_BANK_TRANSFER_DONE',
    event: 'upload_receipt',
    allowedRoles: ['CUSTOMER'],
    to: 'CONTRACT_RECEIPT_UPLOADED',
  },
  {
    from: 'CONTRACT_RECEIPT_UPLOADED',
    event: 'start_verification',
    allowedRoles: ANY_ADMIN,
    to: 'CONTRACT_ADMIN_VERIFYING',
  },
  {
    from: 'CONTRACT_ADMIN_VERIFYING',
    event: 'verify_match',
    allowedRoles: ANY_ADMIN,
    to: 'PAYMENT_PENDING_SUPPLIER_ACK',
  },
  // [إصلاح] a rejected/forged receipt now has an explicit path instead of stalling.
  {
    from: 'CONTRACT_ADMIN_VERIFYING',
    event: 'reject_receipt',
    allowedRoles: ANY_ADMIN,
    to: 'CONTRACT_RECEIPT_REJECTED',
  },
  {
    from: 'CONTRACT_RECEIPT_REJECTED',
    event: 'reupload_receipt',
    allowedRoles: ['CUSTOMER'],
    to: 'CONTRACT_RECEIPT_UPLOADED',
  },
  {
    from: 'CONTRACT_RECEIPT_REJECTED',
    event: 'escalate_to_dispute',
    allowedRoles: ADMIN_OWNER_ONLY,
    to: 'DISPUTE_PAYMENT',
  },

  // ---- Dual-confirmation sub-machine (decision: applies to every trust-fund payment) ----
  {
    from: 'PAYMENT_PENDING_SUPPLIER_ACK',
    event: 'supplier_acknowledges',
    allowedRoles: ['SUPPLIER'],
    to: 'PAYMENT_PENDING_ADMIN_VERIFICATION',
  },
  {
    from: 'PAYMENT_PENDING_ADMIN_VERIFICATION',
    event: 'admin_confirms_with_supplier',
    // ANY_ADMIN gates who may be *involved* at all; the real four-eyes rule
    // (submitter != approver, AND only OWNER/ACCOUNTANT may give the final
    // approve()) is enforced by FinancialApprovalService in apps/api, driven
    // by PERMISSION_MATRIX's SUPPLIER_PAYMENT_ADMIN_VERIFICATION.finalApproverRoles
    // — there is no separate "FourEyesGuard" class; that was a stale comment
    // discovered during review pointing at code that was never written.
    allowedRoles: ANY_ADMIN,
    to: 'SUPPLIER_PAYMENT_CONFIRMED',
  },
  {
    from: 'PAYMENT_PENDING_ADMIN_VERIFICATION',
    event: 'verification_failed',
    allowedRoles: ADMIN_OWNER_ONLY,
    to: 'DISPUTE_PAYMENT',
  },
  {
    from: 'SUPPLIER_PAYMENT_CONFIRMED',
    event: 'reveal_identity',
    allowedRoles: ['SYSTEM'],
    guards: [requireIdentityManagementAndFirstPayment],
    to: 'IDENTITY_REVEALED',
  },
  {
    from: 'IDENTITY_REVEALED',
    event: 'continue',
    allowedRoles: ['SYSTEM'],
    guards: [requireProductionOversight],
    to: 'PROD_DESIGN_SUBMITTED',
    // [إصلاح] discovered during v2 planning: nothing ever scheduled a
    // SUPPLIER_SLA timer here even though supplier_sla_expired (below) exists
    // as an exit from PROD_DESIGN_SUBMITTED — the supplier's own
    // design-upload deadline could never actually fire.
    schedulesTimer: (ctx) => ({ type: 'SUPPLIER_SLA', delayMs: ctx.productionSlaMs ?? 5 * 24 * 60 * 60 * 1000 }),
  },
  {
    from: 'IDENTITY_REVEALED',
    event: 'continue',
    allowedRoles: ['SYSTEM'],
    guards: [requireNoProductionOversight],
    to: 'LOADING_SHIPPING',
  },

  // ---- §4: production ----
  {
    from: 'PROD_DESIGN_SUBMITTED',
    event: 'supplier_uploads_design',
    allowedRoles: ['SUPPLIER'],
    to: 'PROD_CHECKPOINT_1',
    cancelsTimers: ['SUPPLIER_SLA'],
    schedulesTimer: (ctx) => ({ type: 'CUSTOMER_SLA', delayMs: ctx.productionSlaMs ?? 5 * 24 * 60 * 60 * 1000 }),
  },
  // [إصلاح] supplier SLA — symmetric to the customer SLA below, did not exist before.
  {
    from: 'PROD_DESIGN_SUBMITTED',
    event: 'supplier_sla_expired',
    allowedRoles: ['SYSTEM'],
    to: 'ESCALATION_REMINDER',
    schedulesTimer: (ctx) => ({ type: 'ESCALATION_TIMEOUT', delayMs: ctx.escalationTimeoutMs ?? 3 * 24 * 60 * 60 * 1000 }),
  },
  {
    from: 'PROD_CHECKPOINT_1',
    event: 'customer_approves',
    allowedRoles: ['CUSTOMER'],
    to: 'PROD_FULL_PRODUCTION',
    cancelsTimers: ['CUSTOMER_SLA'],
    // [إصلاح] same missing-schedule gap as IDENTITY_REVEALED->PROD_DESIGN_SUBMITTED — supplier_sla_expired existed as an exit from PROD_FULL_PRODUCTION with nothing ever scheduling the timer it depends on.
    schedulesTimer: (ctx) => ({ type: 'SUPPLIER_SLA', delayMs: ctx.productionSlaMs ?? 5 * 24 * 60 * 60 * 1000 }),
  },
  // [إصلاح] explicit rejection, distinct from silent timeout.
  {
    from: 'PROD_CHECKPOINT_1',
    event: 'customer_rejects_explicit',
    allowedRoles: ['CUSTOMER'],
    to: 'PROD_CHECKPOINT_1_REJECTED',
    cancelsTimers: ['CUSTOMER_SLA'],
  },
  {
    from: 'PROD_CHECKPOINT_1_REJECTED',
    event: 'supplier_resubmits',
    allowedRoles: ['SUPPLIER'],
    to: 'PROD_CHECKPOINT_1',
    schedulesTimer: (ctx) => ({ type: 'CUSTOMER_SLA', delayMs: ctx.productionSlaMs ?? 5 * 24 * 60 * 60 * 1000 }),
  },
  {
    from: 'PROD_CHECKPOINT_1',
    event: 'customer_sla_expired',
    allowedRoles: ['SYSTEM'],
    to: 'ESCALATION_REMINDER',
    schedulesTimer: (ctx) => ({ type: 'ESCALATION_TIMEOUT', delayMs: ctx.escalationTimeoutMs ?? 3 * 24 * 60 * 60 * 1000 }),
  },
  {
    from: 'PROD_FULL_PRODUCTION',
    event: 'supplier_uploads_qc',
    allowedRoles: ['SUPPLIER'],
    to: 'PROD_QC_SUBMITTED',
    cancelsTimers: ['SUPPLIER_SLA'],
  },
  // [إصلاح] supplier SLA on the (potentially long) full-production silence window.
  {
    from: 'PROD_FULL_PRODUCTION',
    event: 'supplier_sla_expired',
    allowedRoles: ['SYSTEM'],
    to: 'ESCALATION_REMINDER',
    schedulesTimer: (ctx) => ({ type: 'ESCALATION_TIMEOUT', delayMs: ctx.escalationTimeoutMs ?? 3 * 24 * 60 * 60 * 1000 }),
  },
  {
    from: 'PROD_QC_SUBMITTED',
    event: 'continue',
    allowedRoles: ['SYSTEM'],
    to: 'PROD_CHECKPOINT_2',
    schedulesTimer: (ctx) => ({ type: 'CUSTOMER_SLA', delayMs: ctx.productionSlaMs ?? 5 * 24 * 60 * 60 * 1000 }),
  },
  {
    from: 'PROD_CHECKPOINT_2',
    event: 'customer_approves',
    allowedRoles: ['CUSTOMER'],
    to: 'LOADING_SHIPPING',
    cancelsTimers: ['CUSTOMER_SLA'],
  },
  {
    from: 'PROD_CHECKPOINT_2',
    event: 'customer_rejects_explicit',
    allowedRoles: ['CUSTOMER'],
    to: 'PROD_CHECKPOINT_2_REJECTED',
    cancelsTimers: ['CUSTOMER_SLA'],
  },
  {
    from: 'PROD_CHECKPOINT_2_REJECTED',
    event: 'supplier_resubmits_qc',
    allowedRoles: ['SUPPLIER'],
    to: 'PROD_QC_SUBMITTED',
    schedulesTimer: (ctx) => ({ type: 'CUSTOMER_SLA', delayMs: ctx.productionSlaMs ?? 5 * 24 * 60 * 60 * 1000 }),
  },
  {
    from: 'PROD_CHECKPOINT_2',
    event: 'customer_sla_expired',
    allowedRoles: ['SYSTEM'],
    to: 'ESCALATION_REMINDER',
    schedulesTimer: (ctx) => ({ type: 'ESCALATION_TIMEOUT', delayMs: ctx.escalationTimeoutMs ?? 3 * 24 * 60 * 60 * 1000 }),
  },

  // ---- Escalation (generalized to both customer and supplier) ----
  {
    from: 'ESCALATION_REMINDER',
    event: 'customer_responds',
    allowedRoles: ['CUSTOMER'],
    guards: [requireEscalationActor('CUSTOMER_APPROVAL')],
    to: 'ESCALATION_REMINDER', // placeholder, overridden below
    resolveDynamicTarget: (ctx) => ctx.resumeTargetState ?? 'PROD_CHECKPOINT_1',
    cancelsTimers: ['ESCALATION_TIMEOUT'],
  },
  {
    from: 'ESCALATION_REMINDER',
    event: 'supplier_responds',
    allowedRoles: ['SUPPLIER'],
    guards: [requireEscalationActor('SUPPLIER_DELIVERABLE')],
    to: 'ESCALATION_REMINDER',
    cancelsTimers: ['ESCALATION_TIMEOUT'],
    resolveDynamicTarget: (ctx) => ctx.resumeTargetState ?? 'PROD_DESIGN_SUBMITTED',
  },
  { from: 'ESCALATION_REMINDER', event: 'no_response_timeout', allowedRoles: ['SYSTEM'], to: 'ESCALATION_ESCALATED' },
  {
    from: 'ESCALATION_ESCALATED',
    event: 'customer_responds',
    allowedRoles: ['CUSTOMER'],
    guards: [requireEscalationActor('CUSTOMER_APPROVAL')],
    to: 'ESCALATION_ESCALATED',
    resolveDynamicTarget: (ctx) => ctx.resumeTargetState ?? 'PROD_CHECKPOINT_1',
  },
  {
    from: 'ESCALATION_ESCALATED',
    event: 'supplier_responds',
    allowedRoles: ['SUPPLIER'],
    guards: [requireEscalationActor('SUPPLIER_DELIVERABLE')],
    to: 'ESCALATION_ESCALATED',
    resolveDynamicTarget: (ctx) => ctx.resumeTargetState ?? 'PROD_DESIGN_SUBMITTED',
  },
  {
    from: 'ESCALATION_ESCALATED',
    event: 'customer_no_response_final',
    allowedRoles: ADMIN_OWNER_ONLY,
    guards: [requireEscalationActor('CUSTOMER_APPROVAL')],
    to: 'AGREEMENT_CANCELLED_PENDING_RENEWAL',
  },
  // [إصلاح] supplier's own default no longer forces a full agreement cancellation
  // on the customer — it opens a delay dispute instead (fault lies with the supplier).
  {
    from: 'ESCALATION_ESCALATED',
    event: 'supplier_no_response_final',
    allowedRoles: ADMIN_OWNER_ONLY,
    guards: [requireEscalationActor('SUPPLIER_DELIVERABLE')],
    to: 'DISPUTE_DELAY',
  },

  // ---- Renewal (split into supplier/admin stages — [إصلاح]) ----
  {
    from: 'AGREEMENT_CANCELLED_PENDING_RENEWAL',
    event: 'request_renewal',
    allowedRoles: ['CUSTOMER'],
    to: 'RENEWAL_PENDING_SUPPLIER',
  },
  {
    from: 'RENEWAL_PENDING_SUPPLIER',
    event: 'supplier_approves',
    allowedRoles: ['SUPPLIER'],
    to: 'RENEWAL_PENDING_ADMIN',
  },
  {
    from: 'RENEWAL_PENDING_SUPPLIER',
    event: 'supplier_declines',
    allowedRoles: ['SUPPLIER'],
    to: 'RENEWAL_SUPPLIER_DECLINED',
  },
  // [إصلاح] lighter alternative to a full restart: pick another supplier for the same approved order.
  {
    from: 'RENEWAL_SUPPLIER_DECLINED',
    event: 'pick_alternate_supplier',
    allowedRoles: ADMIN_APPROVAL_ROLES,
    to: 'SUPPLIER_CHOICE',
  },
  {
    from: 'RENEWAL_SUPPLIER_DECLINED',
    event: 'customer_prefers_full_cancel',
    allowedRoles: ['CUSTOMER'],
    forceMandatoryRefundIfEverConfirmed: true,
    to: 'CANCELLED',
  },
  {
    from: 'RENEWAL_PENDING_ADMIN',
    event: 'admin_approves',
    allowedRoles: ADMIN_OWNER_ONLY,
    to: 'RENEWAL_PENDING_ADMIN',
    resolveDynamicTarget: (ctx) => ctx.resumeTargetState ?? 'PROD_DESIGN_SUBMITTED',
  },
  {
    from: 'RENEWAL_PENDING_ADMIN',
    event: 'admin_rejects',
    allowedRoles: ADMIN_OWNER_ONLY,
    forceMandatoryRefundIfEverConfirmed: true,
    to: 'CANCELLED',
  },

  // ---- §6: shipping, customs, delivery ----
  { from: 'LOGISTICS_ONLY_SETUP', event: 'setup_complete', allowedRoles: ANY_ADMIN, to: 'LOADING_SHIPPING' },
  { from: 'LOADING_SHIPPING', event: 'continue', allowedRoles: ANY_ADMIN, to: 'SHIPPING_DOCS' },
  { from: 'SHIPPING_DOCS', event: 'docs_uploaded', allowedRoles: ANY_ADMIN, to: 'PAYMENT_INSTALLMENTS_PENDING' },
  {
    from: 'PAYMENT_INSTALLMENTS_PENDING',
    event: 'installment_confirmed',
    allowedRoles: ['SYSTEM'],
    to: 'IN_TRANSIT',
  },
  { from: 'IN_TRANSIT', event: 'arrived', allowedRoles: ANY_ADMIN, to: 'ARRIVED_PORT' },
  { from: 'ARRIVED_PORT', event: 'start_customs', allowedRoles: ANY_ADMIN, to: 'CUSTOMS_FEE_ADDED' },
  { from: 'CUSTOMS_FEE_ADDED', event: 'fee_published', allowedRoles: ANY_ADMIN, to: 'CUSTOMS_CUSTOMER_PAYS' },
  {
    from: 'CUSTOMS_CUSTOMER_PAYS',
    event: 'customer_pays_uploads_proof',
    allowedRoles: ['CUSTOMER'],
    to: 'CUSTOMS_FEE_PROOF_UPLOADED',
  },
  // [إصلاح] admin verification of the fee payment was missing entirely.
  { from: 'CUSTOMS_FEE_PROOF_UPLOADED', event: 'admin_verifies_fee', allowedRoles: ANY_ADMIN, to: 'CUSTOMS_FEE_VERIFIED' },
  { from: 'CUSTOMS_FEE_PROOF_UPLOADED', event: 'proof_rejected', allowedRoles: ANY_ADMIN, to: 'DISPUTE_PAYMENT' },
  { from: 'CUSTOMS_FEE_VERIFIED', event: 'add_more_fees', allowedRoles: ANY_ADMIN, to: 'CUSTOMS_FEE_ADDED' },
  { from: 'CUSTOMS_FEE_VERIFIED', event: 'no_more_fees', allowedRoles: ANY_ADMIN, to: 'FINAL_DELIVERY' },
  { from: 'FINAL_DELIVERY', event: 'customer_signs', allowedRoles: ['CUSTOMER'], to: 'CUSTOMER_SIGNED' },
  { from: 'CUSTOMER_SIGNED', event: 'rate_supplier', allowedRoles: ['CUSTOMER'], to: 'SUPPLIER_RATED' },
  // [إصلاح] a real terminal state instead of an undefined `[*]`.
  { from: 'SUPPLIER_RATED', event: 'close', allowedRoles: ['SYSTEM'], to: 'COMPLETED' },

  // [إصلاح] dispute coverage extended to shipping/delivery stages, previously missing entirely.
  ...openDisputeRows(['IN_TRANSIT', 'ARRIVED_PORT', ...CUSTOMS_STATES], 'open_shipping_dispute', 'DISPUTE_SHIPPING'),
  ...openDisputeRows(['FINAL_DELIVERY'], 'open_shipping_dispute', 'DISPUTE_SHIPPING'),
  ...openDisputeRows(['CUSTOMER_SIGNED'], 'open_post_signing_dispute_quality', 'DISPUTE_QUALITY'),
  ...openDisputeRows(['CUSTOMER_SIGNED'], 'open_post_signing_dispute_shipping', 'DISPUTE_SHIPPING'),

  // ---- Dispute entry points (docs/state-machine.md §7) ----
  ...openDisputeRows(CONTRACT_PAYMENT_DISPUTE_SOURCES, 'open_payment_dispute', 'DISPUTE_PAYMENT'),
  ...openDisputeRows(PRODUCTION_STATES, 'open_quality_dispute', 'DISPUTE_QUALITY'),
  ...openDisputeRows(PRODUCTION_STATES, 'open_delay_dispute', 'DISPUTE_DELAY'),
  ...openDisputeRows(['ESCALATION_REMINDER', 'ESCALATION_ESCALATED'], 'open_delay_dispute', 'DISPUTE_DELAY'),
  ...openDisputeRows(CUSTOMS_STATES, 'open_payment_dispute', 'DISPUTE_PAYMENT'),

  // ---- Dispute resolution (generic across the four ordinary dispute types) ----
  ...DISPUTE_STATES.flatMap((s) => disputeResolutionRows(s)),

  // ---- Generic administrative cancellation (exercises forceMandatoryRefundIfEverConfirmed directly) ----
  ...adminCancelRows([
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
    ...PRODUCTION_STATES,
    'LOADING_SHIPPING',
    'SHIPPING_DOCS',
  ]),

  // ---- Mandatory refund path ([إصلاح] — decision agreed with the project owner) ----
  {
    from: 'DISPUTE_MANDATORY_REFUND',
    event: 'resolve_with_refund_decision',
    // Either OWNER or ACCOUNTANT may be the one who ends up calling this —
    // docs/data-model.md §1 pairs them (whichever one didn't submit the
    // proposal is the required approver); the actual two-person distinctness
    // is enforced by FinancialApprovalService, not by the role list here.
    allowedRoles: ['ADMIN_OWNER', 'ADMIN_ACCOUNTANT'],
    to: 'DISPUTE_RESOLVED',
  },
  { from: 'DISPUTE_RESOLVED', event: 'final_close', allowedRoles: ['SYSTEM'], to: 'CANCELLED' },
];

export type { DisputeType };
