import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Kysely } from 'kysely';
import { createAdminDb, createTestApp, truncateAll } from './test-app';
import { DB } from '../../src/database/db.types';

const CUSTOMER_1_ID = 'c1111111-1111-1111-1111-111111111111';
const CUSTOMER_2_ID = 'c2222222-2222-2222-2222-222222222222';
const SUPPLIER_1_ID = '51111111-1111-1111-1111-111111111111';
const SUPPLIER_2_ID = '52222222-2222-2222-2222-222222222222';
const OWNER_ID = 'a1111111-1111-1111-1111-111111111111';

describe('Apex Sourcing — customer reads + file uploads (real PostgreSQL, no mocks)', () => {
  let app: INestApplication;
  let db: Kysely<DB>;
  let server: any;
  let customer1Token: string;
  let customer2Token: string;
  let supplier1Token: string;
  let supplier2Token: string;
  let ownerToken: string;

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
      .values([
        { id: CUSTOMER_1_ID, name: 'Ahmed', phone: '0500000001', email: 'ahmed@example.com' },
        { id: CUSTOMER_2_ID, name: 'Sultan', phone: '0500000002', email: 'sultan@example.com' },
      ])
      .execute();
    await db
      .insertInto('registered_supplier')
      .values([
        { id: SUPPLIER_1_ID, legal_name: 'Guangzhou Trading Co' },
        { id: SUPPLIER_2_ID, legal_name: 'Shenzhen Sourcing Ltd' },
      ])
      .execute();
    await db.insertInto('admin_user').values([{ id: OWNER_ID, name: 'Khaled Owner', email: 'khaled@apex.sa', role: 'OWNER', mfa_enabled: true }]).execute();

    customer1Token = (await request(server).post('/auth/dev/customer-token').send({ customerId: CUSTOMER_1_ID })).body.token;
    customer2Token = (await request(server).post('/auth/dev/customer-token').send({ customerId: CUSTOMER_2_ID })).body.token;
    supplier1Token = (await request(server).post('/auth/dev/supplier-token').send({ supplierId: SUPPLIER_1_ID })).body.token;
    supplier2Token = (await request(server).post('/auth/dev/supplier-token').send({ supplierId: SUPPLIER_2_ID })).body.token;
    ownerToken = (await request(server).post('/auth/dev/admin-token').send({ adminId: OWNER_ID, role: 'OWNER' })).body.token;
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

  async function createOrderWithTwoOffers(customerToken: string) {
    const created = await request(server).post('/orders').set('Authorization', `Bearer ${customerToken}`).send({ serviceTypeCode: 'DOOR_TO_DOOR' });
    const orderId: string = created.body.id;
    await request(server).post(`/orders/${orderId}/submit`).set('Authorization', `Bearer ${customerToken}`).send({ expectedStateVersion: 0 });
    await request(server).post(`/orders/${orderId}/confirm-deposit`).set('Authorization', `Bearer ${ownerToken}`).send({ expectedStateVersion: 1 });
    await request(server)
      .post(`/orders/${orderId}/approve`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ expectedStateVersion: 2, supplierType: 'REGISTERED' });
    await request(server).post(`/bidding/${orderId}/offers`).set('Authorization', `Bearer ${supplier1Token}`).send({ fobValueUsd: 10000, leadTimeDays: 30, terms: '30 days' });
    await request(server).post(`/bidding/${orderId}/offers`).set('Authorization', `Bearer ${supplier2Token}`).send({ fobValueUsd: 9500, leadTimeDays: 25, terms: '25 days' });
    await waitForState(orderId, 'REG_ADMIN_REVIEW_BIDS');
    return orderId;
  }

  describe('GET /orders/me', () => {
    it('lists only the calling customer\'s own orders', async () => {
      await request(server).post('/orders').set('Authorization', `Bearer ${customer1Token}`).send({ serviceTypeCode: 'DOOR_TO_DOOR' });
      await request(server).post('/orders').set('Authorization', `Bearer ${customer2Token}`).send({ serviceTypeCode: 'DOOR_TO_DOOR' });

      const mine = await request(server).get('/orders/me').set('Authorization', `Bearer ${customer1Token}`).expect(200);
      expect(mine.body).toHaveLength(1);

      const theirs = await request(server).get('/orders/me').set('Authorization', `Bearer ${customer2Token}`).expect(200);
      expect(theirs.body).toHaveLength(1);
      expect(mine.body[0].id).not.toBe(theirs.body[0].id);
    });
  });

  describe('GET /orders/:id/detail', () => {
    it('returns the aggregated detail payload for the owning customer', async () => {
      const created = await request(server).post('/orders').set('Authorization', `Bearer ${customer1Token}`).send({ serviceTypeCode: 'DOOR_TO_DOOR' });
      const orderId = created.body.id;

      const detail = await request(server).get(`/orders/${orderId}/detail`).set('Authorization', `Bearer ${customer1Token}`).expect(200);
      expect(detail.body.order.id).toBe(orderId);
      expect(detail.body.timeline).toBeInstanceOf(Array);
      expect(detail.body.installments).toEqual([]);
    });

    it('returns 404 (not 403) when a different customer requests it — never confirms the order id exists', async () => {
      const created = await request(server).post('/orders').set('Authorization', `Bearer ${customer1Token}`).send({ serviceTypeCode: 'DOOR_TO_DOOR' });
      const orderId = created.body.id;

      await request(server).get(`/orders/${orderId}/detail`).set('Authorization', `Bearer ${customer2Token}`).expect(404);
    });
  });

  describe('GET /bidding/:orderId/offers/customer-view', () => {
    it('anonymizes the supplier — no legal_name or registered_supplier_id in the response', async () => {
      const orderId = await createOrderWithTwoOffers(customer1Token);
      await request(server)
        .post(`/bidding/${orderId}/review`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ expectedStateVersion: 7, fxRateUsed: 3.75, fxRateSource: 'SAMA', fxReferenceRate: 3.75 });

      const offers = await request(server).get(`/bidding/${orderId}/offers/customer-view`).set('Authorization', `Bearer ${customer1Token}`).expect(200);
      expect(offers.body).toHaveLength(2);
      for (const offer of offers.body) {
        expect(offer).not.toHaveProperty('registered_supplier_id');
        expect(offer).not.toHaveProperty('legal_name');
        expect(offer.supplierLabel).toEqual(expect.stringContaining('المورد'));
      }
    });

    it('rejects viewing offers before the admin has reviewed them (still REG_BIDS_COLLECTING/REG_ADMIN_REVIEW_BIDS)', async () => {
      const orderId = await createOrderWithTwoOffers(customer1Token);
      await request(server).get(`/bidding/${orderId}/offers/customer-view`).set('Authorization', `Bearer ${customer1Token}`).expect(400);
    });
  });

  describe('POST /uploads + GET /uploads/:id', () => {
    it('an order owner uploads a file and can download it back', async () => {
      const created = await request(server).post('/orders').set('Authorization', `Bearer ${customer1Token}`).send({ serviceTypeCode: 'DOOR_TO_DOOR' });
      const orderId = created.body.id;

      const uploaded = await request(server)
        .post('/uploads')
        .set('Authorization', `Bearer ${customer1Token}`)
        .field('orderId', orderId)
        .attach('file', Buffer.from('fake receipt bytes'), 'receipt.pdf')
        .expect(201);
      expect(uploaded.body.id).toEqual(expect.any(String));
      expect(uploaded.body.url).toBe(`/uploads/${uploaded.body.id}`);

      const downloaded = await request(server).get(uploaded.body.url).set('Authorization', `Bearer ${customer1Token}`).expect(200);
      expect(Buffer.from(downloaded.body).toString()).toBe('fake receipt bytes');
    });

    it('rejects uploading a file to an order the actor cannot see', async () => {
      const created = await request(server).post('/orders').set('Authorization', `Bearer ${customer1Token}`).send({ serviceTypeCode: 'DOOR_TO_DOOR' });
      const orderId = created.body.id;

      await request(server)
        .post('/uploads')
        .set('Authorization', `Bearer ${customer2Token}`)
        .field('orderId', orderId)
        .attach('file', Buffer.from('fake bytes'), 'receipt.pdf')
        .expect(404);
    });

    it('rejects downloading a file belonging to an order a different customer cannot see', async () => {
      const created = await request(server).post('/orders').set('Authorization', `Bearer ${customer1Token}`).send({ serviceTypeCode: 'DOOR_TO_DOOR' });
      const orderId = created.body.id;
      const uploaded = await request(server)
        .post('/uploads')
        .set('Authorization', `Bearer ${customer1Token}`)
        .field('orderId', orderId)
        .attach('file', Buffer.from('fake bytes'), 'receipt.pdf')
        .expect(201);

      await request(server).get(uploaded.body.url).set('Authorization', `Bearer ${customer2Token}`).expect(404);
    });
  });
});
