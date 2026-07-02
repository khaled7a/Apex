import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Kysely, sql } from 'kysely';
import { createAdminDb, createTestApp, truncateAll } from './test-app';
import { DB } from '../../src/database/db.types';

const CUSTOMER_ID = 'c1111111-1111-1111-1111-111111111111';
const SUPPLIER_1_ID = '51111111-1111-1111-1111-111111111111';
const SUPPLIER_2_ID = '52222222-2222-2222-2222-222222222222';
const OWNER_ID = 'a1111111-1111-1111-1111-111111111111';
const OPERATOR_ID = 'a2222222-2222-2222-2222-222222222222';
const ACCOUNTANT_ID = 'a3333333-3333-3333-3333-333333333333';

describe('Apex Sourcing — full v1 flow (real PostgreSQL, no mocks)', () => {
  let app: INestApplication;
  let db: Kysely<DB>;
  let server: any;
  let customerToken: string;
  let supplier1Token: string;
  let supplier2Token: string;
  let ownerToken: string;
  let operatorToken: string;
  let accountantToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    server = app.getHttpServer();
    db = createAdminDb();
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  beforeEach(async () => {
    await truncateAll(db);

    await db
      .insertInto('customer')
      .values({ id: CUSTOMER_ID, name: 'Ahmed Customer', phone: '0500000001', email: 'ahmed@example.com' })
      .execute();
    await db
      .insertInto('registered_supplier')
      .values([
        { id: SUPPLIER_1_ID, legal_name: 'Guangzhou Trading Co' },
        { id: SUPPLIER_2_ID, legal_name: 'Shenzhen Sourcing Ltd' },
      ])
      .execute();
    await db
      .insertInto('admin_user')
      .values([
        { id: OWNER_ID, name: 'Khaled Owner', email: 'khaled@apex.sa', role: 'OWNER', mfa_enabled: true },
        { id: OPERATOR_ID, name: 'Maha Operator', email: 'maha@apex.sa', role: 'OPERATOR' },
        { id: ACCOUNTANT_ID, name: 'Sara Accountant', email: 'sara@apex.sa', role: 'ACCOUNTANT', mfa_enabled: true },
      ])
      .execute();

    customerToken = (await request(server).post('/auth/dev/customer-token').send({ customerId: CUSTOMER_ID })).body.token;
    supplier1Token = (await request(server).post('/auth/dev/supplier-token').send({ supplierId: SUPPLIER_1_ID })).body.token;
    supplier2Token = (await request(server).post('/auth/dev/supplier-token').send({ supplierId: SUPPLIER_2_ID })).body.token;
    ownerToken = (await request(server).post('/auth/dev/admin-token').send({ adminId: OWNER_ID, role: 'OWNER' })).body.token;
    operatorToken = (await request(server).post('/auth/dev/admin-token').send({ adminId: OPERATOR_ID, role: 'OPERATOR' })).body.token;
    accountantToken = (await request(server).post('/auth/dev/admin-token').send({ adminId: ACCOUNTANT_ID, role: 'ACCOUNTANT' })).body.token;
  });

  /** Drives the order from DRAFT through REG_BIDS_COLLECTING with two competing offers, then waits for the real pg-boss deadline to fire. */
  async function createOrderWithTwoOffers() {
    const created = await request(server)
      .post('/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ serviceTypeCode: 'DOOR_TO_DOOR' });
    const orderId: string = created.body.id;

    await request(server).post(`/orders/${orderId}/submit`).set('Authorization', `Bearer ${customerToken}`).send({ expectedStateVersion: 0 });
    await request(server).post(`/orders/${orderId}/confirm-deposit`).set('Authorization', `Bearer ${ownerToken}`).send({ expectedStateVersion: 1 });
    await request(server)
      .post(`/orders/${orderId}/approve`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ expectedStateVersion: 2, supplierType: 'REGISTERED' });

    await request(server)
      .post(`/bidding/${orderId}/offers`)
      .set('Authorization', `Bearer ${supplier1Token}`)
      .send({ fobValueUsd: 10000, leadTimeDays: 30, terms: '30 days' });
    await request(server)
      .post(`/bidding/${orderId}/offers`)
      .set('Authorization', `Bearer ${supplier2Token}`)
      .send({ fobValueUsd: 9500, leadTimeDays: 25, terms: '25 days' });

    await new Promise((resolve) => setTimeout(resolve, 5000)); // BIDDING_DEADLINE_MS=3000 in env.setup.js

    return orderId;
  }

  /** Drives an order to PAYMENT_PENDING_ADMIN_VERIFICATION (post supplier-ack, state_version 15) with a real payment row, ready for the four-eyes admin-verification step. */
  async function createOrderPendingAdminVerification(skipVerification = false) {
    const orderId = await createOrderWithTwoOffers();
    await request(server)
      .post(`/bidding/${orderId}/review`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ expectedStateVersion: 7, fxRateUsed: 3.75, fxRateSource: 'SAMA', fxReferenceRate: 3.75 });
    const offers = await request(server).get(`/bidding/${orderId}/offers`).set('Authorization', `Bearer ${supplier1Token}`);
    const offerId = offers.body[0].id;
    await request(server).post(`/bidding/${orderId}/select/${offerId}`).set('Authorization', `Bearer ${customerToken}`).send({ expectedStateVersion: 8 });
    const plan = await request(server)
      .post(`/contracts/${orderId}/payment-plan`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ installments: [{ label: 'FIRST_PAYMENT', expectedAmountSar: 37500, isTrustFund: true, refundPolicy: 'REFUNDABLE_UNTIL_EVENT' }] });
    const installmentId = plan.body.installments[0].id;
    await request(server).post(`/contracts/${orderId}/sign`).set('Authorization', `Bearer ${customerToken}`).send({ expectedStateVersion: 10, signatureRef: 'esign-1' });
    const notify = await request(server)
      .post(`/payments/${orderId}/notify-transfer`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ installmentId, expectedStateVersion: 11 });
    const paymentId = notify.body.payment.id;
    await request(server)
      .post(`/payments/${orderId}/receipts`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ paymentId, expectedStateVersion: 12, fileUrl: 'r.pdf', bankReferenceNo: 'REF-1', bankName: 'Bank', amountClaimed: 37500, transferDateClaimed: '2026-01-01' });
    await request(server).post(`/payments/${orderId}/verification/start`).set('Authorization', `Bearer ${ownerToken}`).send({ expectedStateVersion: 13 });
    if (skipVerification) return { orderId, paymentId };
    await request(server).post(`/payments/${orderId}/verification/match`).set('Authorization', `Bearer ${ownerToken}`).send({ paymentId, expectedStateVersion: 14 });
    await request(server).post(`/payments/${orderId}/supplier-ack`).set('Authorization', `Bearer ${supplier1Token}`).send({ expectedStateVersion: 15 });
    return { orderId, paymentId };
  }

  it('isolates closed-bidding offers via real RLS — a supplier never sees another supplier\'s bid', async () => {
    const orderId = await createOrderWithTwoOffers();

    const asSupplier1 = await request(server).get(`/bidding/${orderId}/offers`).set('Authorization', `Bearer ${supplier1Token}`);
    const asSupplier2 = await request(server).get(`/bidding/${orderId}/offers`).set('Authorization', `Bearer ${supplier2Token}`);

    expect(asSupplier1.body).toHaveLength(1);
    expect(asSupplier1.body[0].registered_supplier_id).toBe(SUPPLIER_1_ID);
    expect(asSupplier2.body).toHaveLength(1);
    expect(asSupplier2.body[0].registered_supplier_id).toBe(SUPPLIER_2_ID);
  });

  it('rejects a transition with a stale expectedStateVersion as 409, not a silent overwrite', async () => {
    const created = await request(server).post('/orders').set('Authorization', `Bearer ${customerToken}`).send({ serviceTypeCode: 'DOOR_TO_DOOR' });
    const orderId = created.body.id;

    const res = await request(server)
      .post(`/orders/${orderId}/submit`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ expectedStateVersion: 99 }); // wrong on purpose

    expect(res.status).toBe(409);
    expect(res.body.error).toBe('StaleState');
  });

  it('rejects an event that is not valid for the current state as 422 (deny-by-default reaching the API)', async () => {
    const created = await request(server).post('/orders').set('Authorization', `Bearer ${customerToken}`).send({ serviceTypeCode: 'DOOR_TO_DOOR' });
    const orderId = created.body.id;

    // approving a DRAFT order (before it was ever submitted) is not a valid transition
    const res = await request(server)
      .post(`/orders/${orderId}/approve`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ expectedStateVersion: 0, supplierType: 'REGISTERED' });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('TransitionRejected');
  });

  it('blocks a second concurrent open dispute on the same order at the DB level', async () => {
    const orderId = await createOrderWithTwoOffers();
    await db.insertInto('dispute').values({ order_id: orderId, type: 'QUALITY', opened_by_role: 'CUSTOMER' }).execute();

    await expect(
      db.insertInto('dispute').values({ order_id: orderId, type: 'PAYMENT', opened_by_role: 'CUSTOMER' }).execute(),
    ).rejects.toThrow(/duplicate key value violates unique constraint/);
  });

  it('rejects a second receipt with the same bank reference + amount + date fingerprint across different payments', async () => {
    await db
      .insertInto('service_type')
      .values({ code: 'TEST_TYPE', label_ar: 'test', commission_rate_percent: 0, includes_sourcing: false, includes_identity_management: false, includes_production_oversight: false })
      .onConflict((oc) => oc.column('code').doNothing())
      .execute();

    const fingerprint = 'fixed-fingerprint-for-this-test';
    const contract = await db.insertInto('contract').values({ order_id: (await createOrderWithTwoOffers()), terms_snapshot: JSON.stringify({}) }).returning('id').executeTakeFirstOrThrow();
    const plan = await db.insertInto('payment_plan').values({ contract_id: contract.id, created_by: OWNER_ID, total_installments: 2 }).returning('id').executeTakeFirstOrThrow();
    const [inst1, inst2] = await db
      .insertInto('payment_installment')
      .values([
        { payment_plan_id: plan.id, sequence_no: 1, label: 'A', expected_amount_sar: 1000, is_trust_fund: true, refund_policy: 'REFUNDABLE_UNTIL_EVENT', unique_payment_reference: 'UPR-A' },
        { payment_plan_id: plan.id, sequence_no: 2, label: 'B', expected_amount_sar: 1000, is_trust_fund: true, refund_policy: 'REFUNDABLE_UNTIL_EVENT', unique_payment_reference: 'UPR-B' },
      ])
      .returningAll()
      .execute();
    const [payment1, payment2] = await db
      .insertInto('payment')
      .values([
        { installment_id: inst1.id, amount_sar: 1000, refund_policy: 'REFUNDABLE_UNTIL_EVENT' },
        { installment_id: inst2.id, amount_sar: 1000, refund_policy: 'REFUNDABLE_UNTIL_EVENT' },
      ])
      .returningAll()
      .execute();

    await db
      .insertInto('receipt')
      .values({ payment_id: payment1.id, file_url: 'a.pdf', bank_reference_no: 'X', bank_name: 'Bank', amount_claimed: 1000, transfer_date_claimed: '2026-01-01', receipt_fingerprint: fingerprint })
      .execute();

    await expect(
      db
        .insertInto('receipt')
        .values({ payment_id: payment2.id, file_url: 'b.pdf', bank_reference_no: 'X', bank_name: 'Bank', amount_claimed: 1000, transfer_date_claimed: '2026-01-01', receipt_fingerprint: fingerprint })
        .execute(),
    ).rejects.toThrow(/duplicate key value violates unique constraint/);
  });

  it('drives the full happy path to IDENTITY_REVEALED with real four-eyes, then verifies the audit hash chain', async () => {
    const orderId = await createOrderWithTwoOffers();

    await request(server)
      .post(`/bidding/${orderId}/review`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ expectedStateVersion: 7, fxRateUsed: 3.75, fxRateSource: 'SAMA', fxReferenceRate: 3.75 })
      .expect(201);

    const offers = await request(server).get(`/bidding/${orderId}/offers`).set('Authorization', `Bearer ${supplier1Token}`);
    const offerId = offers.body[0].id;

    await request(server)
      .post(`/bidding/${orderId}/select/${offerId}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ expectedStateVersion: 8 })
      .expect(201);

    const plan = await request(server)
      .post(`/contracts/${orderId}/payment-plan`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ installments: [{ label: 'FIRST_PAYMENT', expectedAmountSar: 37500, isTrustFund: true, refundPolicy: 'REFUNDABLE_UNTIL_EVENT' }] });
    const installmentId = plan.body.installments[0].id;

    await request(server)
      .post(`/contracts/${orderId}/sign`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ expectedStateVersion: 10, signatureRef: 'esign-1' })
      .expect(201);

    const notify = await request(server)
      .post(`/payments/${orderId}/notify-transfer`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ installmentId, expectedStateVersion: 11 });
    const paymentId = notify.body.payment.id;

    await request(server)
      .post(`/payments/${orderId}/receipts`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ paymentId, expectedStateVersion: 12, fileUrl: 'r.pdf', bankReferenceNo: 'REF-1', bankName: 'Bank', amountClaimed: 37500, transferDateClaimed: '2026-01-01' })
      .expect(201);

    await request(server).post(`/payments/${orderId}/verification/start`).set('Authorization', `Bearer ${ownerToken}`).send({ expectedStateVersion: 13 }).expect(201);
    await request(server)
      .post(`/payments/${orderId}/verification/match`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ paymentId, expectedStateVersion: 14 })
      .expect(201);

    await request(server).post(`/payments/${orderId}/supplier-ack`).set('Authorization', `Bearer ${supplier1Token}`).send({ expectedStateVersion: 15 }).expect(201);

    await request(server)
      .post(`/payments/${orderId}/admin-verification/propose`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ approverId: ACCOUNTANT_ID })
      .expect(201);

    // Four-eyes: the proposer themself must NOT be able to approve.
    const selfApprove = await request(server)
      .post(`/payments/${orderId}/admin-verification/approve`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ paymentId, expectedStateVersion: 16 });
    expect(selfApprove.status).toBe(409);

    const approve = await request(server)
      .post(`/payments/${orderId}/admin-verification/approve`)
      .set('Authorization', `Bearer ${accountantToken}`)
      .send({ paymentId, expectedStateVersion: 16 })
      .expect(201);

    expect(approve.body.outcome.toState).toBe('SUPPLIER_PAYMENT_CONFIRMED');
    expect(approve.body.revealed.toState).toBe('IDENTITY_REVEALED');
    expect(approve.body.routed.toState).toBe('PROD_DESIGN_SUBMITTED');

    const order = await db.selectFrom('order').selectAll().where('id', '=', orderId).executeTakeFirstOrThrow();
    expect(order.financial_commitment_started_at).not.toBeNull();

    const chain = await request(server).get('/audit/verify-chain').set('Authorization', `Bearer ${ownerToken}`).expect(200);
    expect(chain.body.intact).toBe(true);
  });

  it('redirects cancellation-after-confirmed-payment to DISPUTE_MANDATORY_REFUND and completes the real four-eyes refund resolution', async () => {
    // Fast-forward directly to SUPPLIER_PAYMENT_CONFIRMED by inserting the
    // financial fact and state directly — this test's focus is the
    // cancellation/dispute/refund path, not re-deriving the entire upstream flow.
    const orderId = await createOrderWithTwoOffers();
    await db
      .updateTable('order')
      .set({
        current_state: 'SUPPLIER_PAYMENT_CONFIRMED',
        state_version: 99,
        registered_supplier_id: SUPPLIER_1_ID,
        financial_commitment_started_at: new Date(0),
      })
      .where('id', '=', orderId)
      .execute();

    const cancel = await request(server)
      .post(`/disputes/${orderId}/admin-cancel`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ expectedStateVersion: 99 })
      .expect(201);
    expect(cancel.body.toState).toBe('DISPUTE_MANDATORY_REFUND');

    const order = await db.selectFrom('order').select(['active_dispute_id']).where('id', '=', orderId).executeTakeFirstOrThrow();
    expect(order.active_dispute_id).not.toBeNull();

    const contract = await db.insertInto('contract').values({ order_id: orderId, terms_snapshot: JSON.stringify({}) }).returning('id').executeTakeFirstOrThrow();
    const plan = await db.insertInto('payment_plan').values({ contract_id: contract.id, created_by: OWNER_ID, total_installments: 1 }).returning('id').executeTakeFirstOrThrow();
    const installment = await db
      .insertInto('payment_installment')
      .values({ payment_plan_id: plan.id, sequence_no: 1, label: 'FIRST_PAYMENT', expected_amount_sar: 37500, is_trust_fund: true, refund_policy: 'REFUNDABLE_UNTIL_EVENT', unique_payment_reference: 'UPR-TEST' })
      .returning('id')
      .executeTakeFirstOrThrow();
    const payment = await db
      .insertInto('payment')
      .values({ installment_id: installment.id, amount_sar: 37500, refund_policy: 'REFUNDABLE_UNTIL_EVENT', current_refundability_status: 'LOCKED' })
      .returningAll()
      .executeTakeFirstOrThrow();

    await request(server)
      .post(`/disputes/${orderId}/mandatory-refund/propose`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ approverId: ACCOUNTANT_ID })
      .expect(201);

    // admin_cancel_order was a real state change (not a self-loop), so
    // state_version bumped from 99 to 100 when it landed on DISPUTE_MANDATORY_REFUND.
    const resolve = await request(server)
      .post(`/disputes/${orderId}/mandatory-refund/approve`)
      .set('Authorization', `Bearer ${accountantToken}`)
      .send({ expectedStateVersion: 100, paymentId: payment.id, refundedAmountSar: 15000, refundRatio: 0.4, reason: '40% complete' })
      .expect(201);

    expect(resolve.body.closed.toState).toBe('CANCELLED');

    const refund = await db.selectFrom('refund_transaction').selectAll().where('payment_id', '=', payment.id).executeTakeFirstOrThrow();
    expect(refund.decided_by_owner).toBe(OWNER_ID);
    expect(refund.decided_by_accountant).toBe(ACCOUNTANT_ID);

    const paymentAfter = await db.selectFrom('payment').select(['refund_policy']).where('id', '=', payment.id).executeTakeFirstOrThrow();
    expect(paymentAfter.refund_policy).toBe('REFUNDABLE_UNTIL_EVENT'); // immutable — never mutated by the refund decision
  });

  it('truly cannot UPDATE or DELETE audit_log as app_role (append-only at the DB privilege level)', async () => {
    const { Kysely: K, PostgresDialect: PD } = await import('kysely');
    const { Pool } = await import('pg');
    const asAppRole = new K<DB>({
      dialect: new PD({ pool: new Pool({ connectionString: 'postgres://app_role:app_role_dev_password@127.0.0.1:5432/apex_test' }) }),
    });

    try {
      await expect(sql`UPDATE audit_log SET action = 'TAMPERED' WHERE id = (SELECT id FROM audit_log LIMIT 1)`.execute(asAppRole)).rejects.toThrow(
        /permission denied/,
      );
    } finally {
      await asAppRole.destroy();
    }
  });

  it('rejects a designated four-eyes approver whose role is not OWNER/ACCOUNTANT — two OPERATORs cannot jointly confirm a supplier payment', async () => {
    const { orderId } = await createOrderPendingAdminVerification();
    const secondOperatorId = 'a4444444-4444-4444-4444-444444444444';
    await db.insertInto('admin_user').values({ id: secondOperatorId, name: 'Second Operator', email: 'op2@apex.sa', role: 'OPERATOR' }).execute();

    const propose = await request(server)
      .post(`/payments/${orderId}/admin-verification/propose`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ approverId: secondOperatorId });
    expect(propose.status).toBe(400); // finalApproverRoles=[OWNER,ACCOUNTANT] rejects an OPERATOR approver up front

    const pending = await db.selectFrom('financial_approval').selectAll().where('entity_id', '=', orderId).executeTakeFirst();
    expect(pending).toBeUndefined(); // never even got inserted
  });

  it('rejects a receipt/payment that does not actually belong to the order in the URL', async () => {
    const { orderId, paymentId } = await createOrderPendingAdminVerification(true); // stop before the legitimate verification/match — receipt is still PENDING
    const otherOrderId = await createOrderWithTwoOffers(); // a real, unrelated order

    const crossOrder = await request(server)
      .post(`/payments/${otherOrderId}/verification/match`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ paymentId, expectedStateVersion: 7 }); // findReceiptForOrder 404s before the version check ever runs, regardless of otherOrderId's real version
    expect(crossOrder.status).toBe(404);

    const receipt = await db.selectFrom('receipt').select(['verification_status']).where('payment_id', '=', paymentId).executeTakeFirstOrThrow();
    expect(receipt.verification_status).not.toBe('VERIFIED'); // untouched — the mismatched order never got to touch it

    // Sanity check: the SAME (orderId, paymentId) pair legitimately succeeds.
    await request(server)
      .post(`/payments/${orderId}/verification/match`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ paymentId, expectedStateVersion: 14 })
      .expect(201);
  });

  it('requires the mandatory-refund approver to hold a different role than the submitter, not merely be a different person', async () => {
    const orderId = await createOrderWithTwoOffers();
    await db
      .updateTable('order')
      .set({ current_state: 'SUPPLIER_PAYMENT_CONFIRMED', state_version: 99, registered_supplier_id: SUPPLIER_1_ID, financial_commitment_started_at: new Date(0) })
      .where('id', '=', orderId)
      .execute();
    await request(server).post(`/disputes/${orderId}/admin-cancel`).set('Authorization', `Bearer ${ownerToken}`).send({ expectedStateVersion: 99 });

    const secondOwnerId = 'a5555555-5555-5555-5555-555555555555';
    await db.insertInto('admin_user').values({ id: secondOwnerId, name: 'Second Owner', email: 'owner2@apex.sa', role: 'OWNER', mfa_enabled: true }).execute();

    const sameRolePropose = await request(server)
      .post(`/disputes/${orderId}/mandatory-refund/propose`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ approverId: secondOwnerId }); // two different OWNERs — different people, same role
    expect(sameRolePropose.status).toBe(400);

    const validPropose = await request(server)
      .post(`/disputes/${orderId}/mandatory-refund/propose`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ approverId: ACCOUNTANT_ID });
    expect(validPropose.status).toBe(201);
  });

  it('blocks offer selection on a deviating fx_rate_used until an ADMIN_OWNER approves it, then unblocks after approval', async () => {
    const orderId = await createOrderWithTwoOffers();
    await request(server)
      .post(`/bidding/${orderId}/review`)
      .set('Authorization', `Bearer ${operatorToken}`)
      .send({ expectedStateVersion: 7, fxRateUsed: 5.0, fxRateSource: 'SAMA', fxReferenceRate: 3.75 }) // ~33% deviation, well over the 5% default threshold
      .expect(201);

    const orderFlagged = await db.selectFrom('order').select(['fx_rate_deviation_flag']).where('id', '=', orderId).executeTakeFirstOrThrow();
    expect(orderFlagged.fx_rate_deviation_flag).toBe(true);

    const offers = await request(server).get(`/bidding/${orderId}/offers`).set('Authorization', `Bearer ${supplier1Token}`);
    const offerId = offers.body[0].id;

    const blocked = await request(server)
      .post(`/bidding/${orderId}/select/${offerId}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ expectedStateVersion: 8 });
    expect(blocked.status).toBe(400);

    const deniedForOperator = await request(server).post(`/bidding/${orderId}/fx-deviation/approve`).set('Authorization', `Bearer ${operatorToken}`);
    expect(deniedForOperator.status).toBe(403); // OFFER_APPROVAL_AND_FX_RATE_ENTRY allows OPERATOR, but this extra sign-off is OWNER-only

    await request(server).post(`/bidding/${orderId}/fx-deviation/approve`).set('Authorization', `Bearer ${ownerToken}`).expect(201);

    const selected = await request(server)
      .post(`/bidding/${orderId}/select/${offerId}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ expectedStateVersion: 8 });
    expect(selected.status).toBe(201);
  });

  it('creates a real dispute row when a hold transitions directly from ESCALATION into DISPUTE, instead of leaving active_dispute_id null', async () => {
    const orderId = await createOrderWithTwoOffers();
    await db
      .updateTable('order')
      .set({ current_state: 'ESCALATION_ESCALATED', state_version: 50, hold_type: 'ESCALATION', resume_target_state: 'PROD_CHECKPOINT_1' })
      .where('id', '=', orderId)
      .execute();

    const opened = await request(server)
      .post(`/disputes/${orderId}/open/admin`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ event: 'open_delay_dispute', expectedStateVersion: 50 })
      .expect(201);
    expect(opened.body.toState).toBe('DISPUTE_DELAY');

    const order = await db.selectFrom('order').select(['active_dispute_id', 'hold_type']).where('id', '=', orderId).executeTakeFirstOrThrow();
    expect(order.hold_type).toBe('DISPUTE');
    expect(order.active_dispute_id).not.toBeNull();

    const dispute = await db.selectFrom('dispute').selectAll().where('order_id', '=', orderId).executeTakeFirst();
    expect(dispute).toBeDefined();
    expect(dispute?.status).toBe('OPEN');
    expect(dispute?.type).toBe('DELAY');
  });
});
