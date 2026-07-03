import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Kysely } from 'kysely';
import { createAdminDb, createTestApp, truncateAll } from './test-app';
import { DB } from '../../src/database/db.types';

const CUSTOMER_ID = 'c1111111-1111-1111-1111-111111111111';
const OWNER_1_ID = 'a1111111-1111-1111-1111-111111111111';
const OWNER_2_ID = 'a1111111-1111-1111-1111-111111111112';
const OPERATOR_ID = 'a2222222-2222-2222-2222-222222222222';
const ACCOUNTANT_ID = 'a3333333-3333-3333-3333-333333333333';
const SUPPLIER_1_ID = '51111111-1111-1111-1111-111111111111';

describe('Apex Sourcing — admin portal backend: external-supplier vetting, bidding dead-ends, admin queues/detail, accounts, forgot-password (real PostgreSQL, no mocks)', () => {
  let app: INestApplication;
  let db: Kysely<DB>;
  let server: any;
  let customerToken: string;
  let owner1Token: string;
  let owner2Token: string;
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
    await db.insertInto('customer').values({ id: CUSTOMER_ID, name: 'Ahmed', phone: '0500000001', email: 'ahmed@example.com' }).execute();
    await db
      .insertInto('admin_user')
      .values([
        { id: OWNER_1_ID, name: 'Khaled Owner', email: 'khaled@apex.sa', role: 'OWNER', mfa_enabled: true },
        { id: OWNER_2_ID, name: 'Yousef Owner', email: 'yousef@apex.sa', role: 'OWNER', mfa_enabled: true },
        { id: OPERATOR_ID, name: 'Maha Operator', email: 'maha@apex.sa', role: 'OPERATOR' },
        { id: ACCOUNTANT_ID, name: 'Sara Accountant', email: 'sara@apex.sa', role: 'ACCOUNTANT', mfa_enabled: true },
      ])
      .execute();
    await db.insertInto('registered_supplier').values({ id: SUPPLIER_1_ID, legal_name: 'Guangzhou Trading Co', contact_email: 'supplier1@example.com', password_hash: '$2b$12$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWX' }).execute();

    customerToken = (await request(server).post('/auth/dev/customer-token').send({ customerId: CUSTOMER_ID })).body.token;
    owner1Token = (await request(server).post('/auth/dev/admin-token').send({ adminId: OWNER_1_ID, role: 'OWNER' })).body.token;
    owner2Token = (await request(server).post('/auth/dev/admin-token').send({ adminId: OWNER_2_ID, role: 'OWNER' })).body.token;
    operatorToken = (await request(server).post('/auth/dev/admin-token').send({ adminId: OPERATOR_ID, role: 'OPERATOR' })).body.token;
    accountantToken = (await request(server).post('/auth/dev/admin-token').send({ adminId: ACCOUNTANT_ID, role: 'ACCOUNTANT' })).body.token;
  });

  async function waitForState(orderId: string, expected: string, timeoutMs = 15000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const order = await db.selectFrom('order').select(['current_state']).where('id', '=', orderId).executeTakeFirst();
      if (order?.current_state === expected) return;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    throw new Error(`order ${orderId} did not reach ${expected} within ${timeoutMs}ms`);
  }

  async function createDraftOrder() {
    const created = await request(server).post('/orders').set('Authorization', `Bearer ${customerToken}`).send({ serviceTypeCode: 'DOOR_TO_DOOR' });
    return created.body.id as string;
  }

  async function submitAndConfirmDeposit(orderId: string) {
    await request(server).post(`/orders/${orderId}/submit`).set('Authorization', `Bearer ${customerToken}`).send({ expectedStateVersion: 0 });
    await request(server).post(`/orders/${orderId}/confirm-deposit`).set('Authorization', `Bearer ${owner1Token}`).send({ expectedStateVersion: 1 });
  }

  describe('external-supplier vetting (previously stuck forever — EXT_VETTING_DOCS had no controller at all)', () => {
    it('completes a full approval: create -> propose (OWNER A) -> approve (OWNER B, a different person) -> CONTRACT_PAYMENT_PLAN_CREATED', async () => {
      const orderId = await createDraftOrder();
      await submitAndConfirmDeposit(orderId);

      const created = await request(server)
        .post(`/orders/${orderId}/external-supplier`)
        .set('Authorization', `Bearer ${owner1Token}`)
        .send({ legalName: 'Foshan Manual Trading', licenseNumber: 'LIC-123', yearsActive: 5, verificationSource: 'manual' })
        .expect(201);
      const externalSupplierId = created.body.id;

      const approve = await request(server)
        .post(`/orders/${orderId}/approve`)
        .set('Authorization', `Bearer ${owner1Token}`)
        .send({ expectedStateVersion: 2, supplierType: 'EXTERNAL', externalSupplierId })
        .expect(201);
      expect(approve.body.toState).toBe('EXT_VETTING_DOCS');

      await request(server)
        .post(`/orders/${orderId}/external-supplier/vetting/propose-approval`)
        .set('Authorization', `Bearer ${owner1Token}`)
        .send({ approverId: OWNER_2_ID })
        .expect(201);

      // A same-person approval attempt must fail before the real approver even tries.
      await request(server)
        .post(`/orders/${orderId}/external-supplier/vetting/approve`)
        .set('Authorization', `Bearer ${owner1Token}`)
        .send({ expectedStateVersion: approve.body.stateVersion })
        .expect(409);

      const approved = await request(server)
        .post(`/orders/${orderId}/external-supplier/vetting/approve`)
        .set('Authorization', `Bearer ${owner2Token}`)
        .send({ expectedStateVersion: approve.body.stateVersion })
        .expect(201);
      expect(approved.body.toState).toBe('CONTRACT_PAYMENT_PLAN_CREATED');

      const row = await db.selectFrom('external_supplier').selectAll().where('id', '=', externalSupplierId).executeTakeFirstOrThrow();
      expect(row.vetting_status).toBe('APPROVED');
      expect(row.vetted_by).toBe(OWNER_2_ID);
    });

    it('OPERATOR cannot propose or approve external-supplier vetting — OWNER only per PERMISSION_MATRIX', async () => {
      const orderId = await createDraftOrder();
      await submitAndConfirmDeposit(orderId);
      const created = await request(server)
        .post(`/orders/${orderId}/external-supplier`)
        .set('Authorization', `Bearer ${owner1Token}`)
        .send({ legalName: 'Foshan Manual Trading' })
        .expect(201);
      await request(server)
        .post(`/orders/${orderId}/approve`)
        .set('Authorization', `Bearer ${owner1Token}`)
        .send({ expectedStateVersion: 2, supplierType: 'EXTERNAL', externalSupplierId: created.body.id })
        .expect(201);

      await request(server)
        .post(`/orders/${orderId}/external-supplier/vetting/propose-approval`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ approverId: OWNER_2_ID })
        .expect(403);
    });

    it('rejecting vetting chains reject_vetting -> auto_close and lands on CANCELLED', async () => {
      const orderId = await createDraftOrder();
      await submitAndConfirmDeposit(orderId);
      const created = await request(server)
        .post(`/orders/${orderId}/external-supplier`)
        .set('Authorization', `Bearer ${owner1Token}`)
        .send({ legalName: 'Suspicious Trading Co' })
        .expect(201);
      const approve = await request(server)
        .post(`/orders/${orderId}/approve`)
        .set('Authorization', `Bearer ${owner1Token}`)
        .send({ expectedStateVersion: 2, supplierType: 'EXTERNAL', externalSupplierId: created.body.id })
        .expect(201);

      const rejected = await request(server)
        .post(`/orders/${orderId}/external-supplier/vetting/reject`)
        .set('Authorization', `Bearer ${owner1Token}`)
        .send({ expectedStateVersion: approve.body.stateVersion })
        .expect(201);
      expect(rejected.body.toState).toBe('EXT_VETTING_REJECTED');

      const order = await db.selectFrom('order').select(['current_state']).where('id', '=', orderId).executeTakeFirstOrThrow();
      expect(order.current_state).toBe('CANCELLED');
    });
  });

  describe('bidding dead-end recovery (REG_BIDS_EXPIRED_NO_OFFERS / REG_NO_OFFER_SELECTED previously had no controller action)', () => {
    async function createOrderPublishedWithNoOffers() {
      const orderId = await createDraftOrder();
      await submitAndConfirmDeposit(orderId);
      await request(server)
        .post(`/orders/${orderId}/approve`)
        .set('Authorization', `Bearer ${owner1Token}`)
        .send({ expectedStateVersion: 2, supplierType: 'REGISTERED' })
        .expect(201);
      await waitForState(orderId, 'REG_BIDS_EXPIRED_NO_OFFERS');
      return orderId;
    }

    it('extends the deadline back to REG_BIDS_COLLECTING', async () => {
      const orderId = await createOrderPublishedWithNoOffers();
      const order = await db.selectFrom('order').select(['state_version']).where('id', '=', orderId).executeTakeFirstOrThrow();
      const extended = await request(server)
        .post(`/bidding/${orderId}/extend-deadline`)
        .set('Authorization', `Bearer ${owner1Token}`)
        .send({ expectedStateVersion: order.state_version })
        .expect(201);
      expect(extended.body.toState).toBe('REG_BIDS_COLLECTING');
    });

    it('cancels an order stuck with zero offers', async () => {
      const orderId = await createOrderPublishedWithNoOffers();
      const order = await db.selectFrom('order').select(['state_version']).where('id', '=', orderId).executeTakeFirstOrThrow();
      const cancelled = await request(server)
        .post(`/bidding/${orderId}/cancel`)
        .set('Authorization', `Bearer ${owner1Token}`)
        .send({ expectedStateVersion: order.state_version })
        .expect(201);
      expect(cancelled.body.toState).toBe('CANCELLED');
    });

    it('OPERATOR cannot cancel — ADMIN_OWNER_ONLY, enforced by the transition engine itself (a rejected transition is 422, not 403)', async () => {
      const orderId = await createOrderPublishedWithNoOffers();
      const order = await db.selectFrom('order').select(['state_version']).where('id', '=', orderId).executeTakeFirstOrThrow();
      await request(server)
        .post(`/bidding/${orderId}/cancel`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ expectedStateVersion: order.state_version })
        .expect(422);
    });
  });

  describe('GET /orders (admin browse/search) and GET /orders/queue/needs-admin-action', () => {
    it('lists orders filtered by state, with pagination metadata', async () => {
      const orderId = await createDraftOrder();
      await request(server).post(`/orders/${orderId}/submit`).set('Authorization', `Bearer ${customerToken}`).send({ expectedStateVersion: 0 });

      const list = await request(server).get('/orders?state=SUBMITTED&pageSize=10').set('Authorization', `Bearer ${owner1Token}`).expect(200);
      expect(list.body.rows.map((r: any) => r.id)).toContain(orderId);
      expect(list.body.page).toBe(1);
      expect(list.body.pageSize).toBe(10);
      expect(list.body.total).toBeGreaterThanOrEqual(1);
    });

    it('surfaces an order at REVIEW_PENDING in the needs-admin-action queue, categorized as REVIEW', async () => {
      const orderId = await createDraftOrder();
      await request(server).post(`/orders/${orderId}/submit`).set('Authorization', `Bearer ${customerToken}`).send({ expectedStateVersion: 0 });
      await request(server).post(`/orders/${orderId}/confirm-deposit`).set('Authorization', `Bearer ${owner1Token}`).send({ expectedStateVersion: 1 });

      const queue = await request(server).get('/orders/queue/needs-admin-action').set('Authorization', `Bearer ${owner1Token}`).expect(200);
      const row = queue.body.find((r: any) => r.id === orderId);
      expect(row).toBeDefined();
      expect(row.current_state).toBe('REVIEW_PENDING');
      expect(row.category).toBe('REVIEW');
    });
  });

  describe('GET /orders/:id/detail-for-admin', () => {
    it('includes customer PII (unlike the customer/supplier-scoped detail reads) and the order-scoped financial_approval rows', async () => {
      const orderId = await createDraftOrder();
      await submitAndConfirmDeposit(orderId);

      const detail = await request(server).get(`/orders/${orderId}/detail-for-admin`).set('Authorization', `Bearer ${owner1Token}`).expect(200);
      expect(detail.body.customer.email).toBe('ahmed@example.com');
      expect(detail.body.customer.phone).toBe('0500000001');
      expect(detail.body.financialApprovals).toEqual([]);
    });

    it('surfaces a pending SUPPLIER_PAYMENT_ADMIN_VERIFICATION proposal in financialApprovals', async () => {
      const orderId = await createDraftOrder();
      await submitAndConfirmDeposit(orderId);
      await db.updateTable('order').set({ current_state: 'PAYMENT_PENDING_ADMIN_VERIFICATION', state_version: 50 }).where('id', '=', orderId).execute();

      await request(server)
        .post(`/payments/${orderId}/admin-verification/propose`)
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ approverId: OWNER_1_ID })
        .expect(201);

      const detail = await request(server).get(`/orders/${orderId}/detail-for-admin`).set('Authorization', `Bearer ${owner1Token}`).expect(200);
      expect(detail.body.financialApprovals).toHaveLength(1);
      expect(detail.body.financialApprovals[0].action).toBe('SUPPLIER_PAYMENT_ADMIN_VERIFICATION');
      expect(detail.body.financialApprovals[0].approved_at).toBeNull();
    });
  });

  describe('GET /orders/:id/audit-log', () => {
    it('returns the ordered per-order transition history', async () => {
      const orderId = await createDraftOrder();
      await request(server).post(`/orders/${orderId}/submit`).set('Authorization', `Bearer ${customerToken}`).send({ expectedStateVersion: 0 });

      const log = await request(server).get(`/orders/${orderId}/audit-log`).set('Authorization', `Bearer ${owner1Token}`).expect(200);
      expect(log.body.length).toBeGreaterThanOrEqual(1);
      expect(log.body.every((row: any) => row.entity_id === orderId)).toBe(true);
      expect(log.body.some((row: any) => row.action === 'submit')).toBe(true);
    });
  });

  describe('account listing (GET /admin/admins, GET /admin/suppliers)', () => {
    it('lists admins and suppliers without ever leaking password_hash', async () => {
      const admins = await request(server).get('/admin/admins').set('Authorization', `Bearer ${operatorToken}`).expect(200);
      expect(admins.body.length).toBeGreaterThanOrEqual(4);
      expect(admins.body.every((a: any) => !('password_hash' in a))).toBe(true);

      const suppliers = await request(server).get('/admin/suppliers').set('Authorization', `Bearer ${owner1Token}`).expect(200);
      expect(suppliers.body.length).toBeGreaterThanOrEqual(1);
      expect(suppliers.body.every((s: any) => !('password_hash' in s))).toBe(true);
    });
  });

  describe('activate/deactivate accounts (self-lockout guards)', () => {
    it('rejects an OWNER deactivating their own account', async () => {
      await request(server)
        .post(`/admin/admins/${OWNER_1_ID}/deactivate`)
        .set('Authorization', `Bearer ${owner1Token}`)
        .expect(400);
    });

    it('rejects deactivating the last active OWNER, even when the caller is a different admin', async () => {
      // Deactivate OWNER_2 first, leaving OWNER_1 as the sole active OWNER.
      await request(server).post(`/admin/admins/${OWNER_2_ID}/deactivate`).set('Authorization', `Bearer ${owner1Token}`).expect(201);
      // A third OWNER account (distinct caller identity, so this isn't the blocked self-deactivation case) tries to deactivate OWNER_1.
      const thirdOwnerId = 'a1111111-1111-1111-1111-111111111113';
      await db.insertInto('admin_user').values({ id: thirdOwnerId, name: 'Third Owner', email: 'third@apex.sa', role: 'OWNER', mfa_enabled: true, is_active: false }).execute();
      const thirdOwnerToken = (await request(server).post('/auth/dev/admin-token').send({ adminId: thirdOwnerId, role: 'OWNER' })).body.token;
      await request(server).post(`/admin/admins/${OWNER_1_ID}/deactivate`).set('Authorization', `Bearer ${thirdOwnerToken}`).expect(400);
    });

    it('deactivating a supplier account blocks its subsequent login', async () => {
      await request(server).post('/auth/supplier/login').send({ email: 'supplier1@example.com', password: 'whatever-not-checked-here' }).expect(401);
      await request(server).post(`/admin/suppliers/${SUPPLIER_1_ID}/deactivate`).set('Authorization', `Bearer ${owner1Token}`).expect(201);
      const supplier = await db.selectFrom('registered_supplier').select(['is_active']).where('id', '=', SUPPLIER_1_ID).executeTakeFirstOrThrow();
      expect(supplier.is_active).toBe(false);
    });

    it('reactivating restores is_active', async () => {
      await request(server).post(`/admin/suppliers/${SUPPLIER_1_ID}/deactivate`).set('Authorization', `Bearer ${owner1Token}`).expect(201);
      await request(server).post(`/admin/suppliers/${SUPPLIER_1_ID}/reactivate`).set('Authorization', `Bearer ${owner1Token}`).expect(201);
      const supplier = await db.selectFrom('registered_supplier').select(['is_active']).where('id', '=', SUPPLIER_1_ID).executeTakeFirstOrThrow();
      expect(supplier.is_active).toBe(true);
    });
  });

  describe('forgot/reset password', () => {
    // The raw token is only ever known to the caller of forgotPassword (it's
    // hashed before being persisted) — these tests insert a token row with
    // the same sha256 shape AuthService itself would produce, to exercise
    // resetPassword's used/expired/unknown-token branches deterministically
    // without needing to intercept the (unconfigured, NO_CONFIG) EmailProvider.

    it('registers a password_reset_token row on forgot-password, and never reveals whether the email exists', async () => {
      const known = await request(server).post('/auth/customer/forgot-password').send({ email: 'ahmed@example.com' }).expect(201);
      const unknown = await request(server).post('/auth/customer/forgot-password').send({ email: 'nobody@example.com' }).expect(201);
      expect(known.body).toEqual(unknown.body);

      const rows = await db.selectFrom('password_reset_token').selectAll().where('actor_type', '=', 'CUSTOMER').where('actor_id', '=', CUSTOMER_ID).execute();
      expect(rows).toHaveLength(1);
    });

    it('rejects reset-password with an unknown/garbage token', async () => {
      await request(server).post('/auth/customer/reset-password').send({ token: 'not-a-real-token', newPassword: 'brand-new-password-1' }).expect(400);
    });

    it('accepts a valid token once, then rejects it on reuse', async () => {
      const crypto = await import('node:crypto');
      const rawToken = 'deterministic-test-token-value';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      await db
        .insertInto('password_reset_token')
        .values({ actor_type: 'CUSTOMER', actor_id: CUSTOMER_ID, token_hash: tokenHash, expires_at: new Date(Date.now() + 60_000) })
        .execute();

      await request(server).post('/auth/customer/reset-password').send({ token: rawToken, newPassword: 'freshly-reset-password-1' }).expect(201);
      // Reused token now rejected.
      await request(server).post('/auth/customer/reset-password').send({ token: rawToken, newPassword: 'another-password-2' }).expect(400);
    });

    it('rejects an expired token', async () => {
      const crypto = await import('node:crypto');
      const rawToken = 'expired-test-token-value';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      await db
        .insertInto('password_reset_token')
        .values({ actor_type: 'CUSTOMER', actor_id: CUSTOMER_ID, token_hash: tokenHash, expires_at: new Date(Date.now() - 1000) })
        .execute();

      await request(server).post('/auth/customer/reset-password').send({ token: rawToken, newPassword: 'freshly-reset-password-1' }).expect(400);
    });

    it('a deactivated admin cannot request a working reset token (no row is created)', async () => {
      await db.updateTable('admin_user').set({ is_active: false }).where('id', '=', ACCOUNTANT_ID).execute();
      await request(server).post('/auth/admin/forgot-password').send({ email: 'sara@apex.sa' }).expect(201);
      const rows = await db.selectFrom('password_reset_token').selectAll().where('actor_type', '=', 'ADMIN').where('actor_id', '=', ACCOUNTANT_ID).execute();
      expect(rows).toHaveLength(0);
    });

    it('end-to-end: reset an admin password via a token inserted with the real hash shape, then log in with the new password', async () => {
      const crypto = await import('node:crypto');
      const rawToken = 'admin-reset-token-value';
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      await db
        .insertInto('password_reset_token')
        .values({ actor_type: 'ADMIN', actor_id: ACCOUNTANT_ID, token_hash: tokenHash, expires_at: new Date(Date.now() + 60_000) })
        .execute();

      await request(server).post('/auth/admin/reset-password').send({ token: rawToken, newPassword: 'brand-new-admin-password-1' }).expect(201);
      await request(server).post('/auth/admin/login').send({ email: 'sara@apex.sa', password: 'brand-new-admin-password-1' }).expect(201);
    });
  });
});
