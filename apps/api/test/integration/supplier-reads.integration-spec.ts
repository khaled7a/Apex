import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Kysely } from 'kysely';
import { createAdminDb, createTestApp, truncateAll } from './test-app';
import { DB } from '../../src/database/db.types';

const CUSTOMER_ID = 'c1111111-1111-1111-1111-111111111111';
const SUPPLIER_1_ID = '51111111-1111-1111-1111-111111111111';
const SUPPLIER_2_ID = '52222222-2222-2222-2222-222222222222';
const OWNER_ID = 'a1111111-1111-1111-1111-111111111111';

describe('Apex Sourcing — supplier reads: bidding board, assigned orders, detail (real PostgreSQL, no mocks)', () => {
  let app: INestApplication;
  let db: Kysely<DB>;
  let server: any;
  let customerToken: string;
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
    await db.insertInto('customer').values({ id: CUSTOMER_ID, name: 'Ahmed', phone: '0500000001', email: 'ahmed@example.com' }).execute();
    await db
      .insertInto('registered_supplier')
      .values([
        { id: SUPPLIER_1_ID, legal_name: 'Guangzhou Trading Co' },
        { id: SUPPLIER_2_ID, legal_name: 'Shenzhen Sourcing Ltd' },
      ])
      .execute();
    await db.insertInto('admin_user').values([{ id: OWNER_ID, name: 'Khaled Owner', email: 'khaled@apex.sa', role: 'OWNER', mfa_enabled: true }]).execute();

    customerToken = (await request(server).post('/auth/dev/customer-token').send({ customerId: CUSTOMER_ID })).body.token;
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

  async function createPublishedOrder() {
    const created = await request(server).post('/orders').set('Authorization', `Bearer ${customerToken}`).send({ serviceTypeCode: 'DOOR_TO_DOOR' });
    const orderId: string = created.body.id;
    await request(server).post(`/orders/${orderId}/submit`).set('Authorization', `Bearer ${customerToken}`).send({ expectedStateVersion: 0 });
    await request(server).post(`/orders/${orderId}/confirm-deposit`).set('Authorization', `Bearer ${ownerToken}`).send({ expectedStateVersion: 1 });
    await request(server)
      .post(`/orders/${orderId}/approve`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ expectedStateVersion: 2, supplierType: 'REGISTERED' });
    return orderId;
  }

  it('lists a freshly published order on the bidding board for any supplier', async () => {
    const orderId = await createPublishedOrder();

    const board1 = await request(server).get('/bidding/board').set('Authorization', `Bearer ${supplier1Token}`).expect(200);
    const board2 = await request(server).get('/bidding/board').set('Authorization', `Bearer ${supplier2Token}`).expect(200);

    expect(board1.body.map((row: any) => row.order_id)).toContain(orderId);
    expect(board2.body.map((row: any) => row.order_id)).toContain(orderId);
    const row = board1.body.find((r: any) => r.order_id === orderId);
    expect(row.serviceTypeLabel).toBe('باب لباب');
  });

  it('moves the order from the bidding board to assigned-to-me for the winning supplier once selected', async () => {
    const orderId = await createPublishedOrder();
    await request(server).post(`/bidding/${orderId}/offers`).set('Authorization', `Bearer ${supplier1Token}`).send({ fobValueUsd: 10000, leadTimeDays: 30, terms: '30 days' });
    await request(server).post(`/bidding/${orderId}/offers`).set('Authorization', `Bearer ${supplier2Token}`).send({ fobValueUsd: 9500, leadTimeDays: 25, terms: '25 days' });
    await waitForState(orderId, 'REG_ADMIN_REVIEW_BIDS');

    await request(server)
      .post(`/bidding/${orderId}/review`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ expectedStateVersion: 7, fxRateUsed: 3.75, fxRateSource: 'SAMA', fxReferenceRate: 3.75 });
    const offers = await request(server).get(`/bidding/${orderId}/offers`).set('Authorization', `Bearer ${supplier1Token}`);
    const offerId = offers.body[0].id;
    await request(server).post(`/bidding/${orderId}/select/${offerId}`).set('Authorization', `Bearer ${customerToken}`).send({ expectedStateVersion: 8 });

    const assignedToWinner = await request(server).get('/orders/assigned-to-me').set('Authorization', `Bearer ${supplier1Token}`).expect(200);
    expect(assignedToWinner.body.map((o: any) => o.id)).toContain(orderId);

    const assignedToLoser = await request(server).get('/orders/assigned-to-me').set('Authorization', `Bearer ${supplier2Token}`).expect(200);
    expect(assignedToLoser.body.map((o: any) => o.id)).not.toContain(orderId);

    const boardAfter = await request(server).get('/bidding/board').set('Authorization', `Bearer ${supplier1Token}`).expect(200);
    expect(boardAfter.body.map((row: any) => row.order_id)).not.toContain(orderId);
  });

  describe('GET /orders/:id/detail-for-supplier', () => {
    it('returns the aggregated detail with no customer field anywhere in the response, for the winning supplier only', async () => {
      const orderId = await createPublishedOrder();
      await request(server)
        .post(`/bidding/${orderId}/offers`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({ fobValueUsd: 10000, leadTimeDays: 30, terms: '30 days' });
      await waitForState(orderId, 'REG_ADMIN_REVIEW_BIDS');
      await request(server)
        .post(`/bidding/${orderId}/review`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ expectedStateVersion: 7, fxRateUsed: 3.75, fxRateSource: 'SAMA', fxReferenceRate: 3.75 });
      const offers = await request(server).get(`/bidding/${orderId}/offers`).set('Authorization', `Bearer ${supplier1Token}`);
      await request(server).post(`/bidding/${orderId}/select/${offers.body[0].id}`).set('Authorization', `Bearer ${customerToken}`).send({ expectedStateVersion: 8 });

      const detail = await request(server).get(`/orders/${orderId}/detail-for-supplier`).set('Authorization', `Bearer ${supplier1Token}`).expect(200);
      expect(detail.body.order.id).toBe(orderId);
      const serialized = JSON.stringify(detail.body);
      expect(serialized).not.toContain('ahmed@example.com');
      expect(serialized).not.toContain('0500000001');
      expect(detail.body).not.toHaveProperty('shippingDocuments');
      expect(detail.body).not.toHaveProperty('customsFees');
      expect(detail.body).not.toHaveProperty('receipts');
    });

    it('returns 404 for a supplier who was not awarded this order', async () => {
      const orderId = await createPublishedOrder();
      await request(server)
        .post(`/bidding/${orderId}/offers`)
        .set('Authorization', `Bearer ${supplier1Token}`)
        .send({ fobValueUsd: 10000, leadTimeDays: 30, terms: '30 days' });
      await waitForState(orderId, 'REG_ADMIN_REVIEW_BIDS');
      await request(server)
        .post(`/bidding/${orderId}/review`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ expectedStateVersion: 7, fxRateUsed: 3.75, fxRateSource: 'SAMA', fxReferenceRate: 3.75 });
      const offers = await request(server).get(`/bidding/${orderId}/offers`).set('Authorization', `Bearer ${supplier1Token}`);
      await request(server).post(`/bidding/${orderId}/select/${offers.body[0].id}`).set('Authorization', `Bearer ${customerToken}`).send({ expectedStateVersion: 8 });

      await request(server).get(`/orders/${orderId}/detail-for-supplier`).set('Authorization', `Bearer ${supplier2Token}`).expect(404);
    });
  });
});
