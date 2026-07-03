import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Kysely } from 'kysely';
import { createAdminDb, createTestApp, truncateAll } from './test-app';
import { DB } from '../../src/database/db.types';

describe('Apex Sourcing — real credential-based auth (real PostgreSQL, no mocks)', () => {
  let app: INestApplication;
  let db: Kysely<DB>;
  let server: any;

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
  });

  it('registers a new customer, then logs in with the same credentials', async () => {
    const register = await request(server)
      .post('/auth/customer/register')
      .send({ name: 'Ahmed', email: 'ahmed@example.com', phone: '0500000001', password: 'correct-horse-battery' })
      .expect(201);
    expect(register.body.token).toEqual(expect.any(String));

    const login = await request(server)
      .post('/auth/customer/login')
      .send({ email: 'ahmed@example.com', password: 'correct-horse-battery' })
      .expect(201);
    expect(login.body.token).toEqual(expect.any(String));
  });

  it('rejects registering the same email twice with 409', async () => {
    await request(server)
      .post('/auth/customer/register')
      .send({ name: 'Ahmed', email: 'dup@example.com', phone: '0500000001', password: 'correct-horse-battery' })
      .expect(201);

    await request(server)
      .post('/auth/customer/register')
      .send({ name: 'Someone Else', email: 'dup@example.com', phone: '0500000002', password: 'another-password' })
      .expect(409);
  });

  it('rejects a wrong password with a generic 401 — and never leaks whether the email even exists', async () => {
    await request(server)
      .post('/auth/customer/register')
      .send({ name: 'Ahmed', email: 'ahmed2@example.com', phone: '0500000001', password: 'correct-horse-battery' })
      .expect(201);

    const wrongPassword = await request(server).post('/auth/customer/login').send({ email: 'ahmed2@example.com', password: 'wrong' }).expect(401);
    const unknownEmail = await request(server).post('/auth/customer/login').send({ email: 'nobody@example.com', password: 'wrong' }).expect(401);
    expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
  });

  it('never returns password_hash in any auth response body', async () => {
    const register = await request(server)
      .post('/auth/customer/register')
      .send({ name: 'Ahmed', email: 'noleak@example.com', phone: '0500000001', password: 'correct-horse-battery' })
      .expect(201);
    expect(register.body).not.toHaveProperty('password_hash');
    expect(register.body).not.toHaveProperty('passwordHash');

    const login = await request(server).post('/auth/customer/login').send({ email: 'noleak@example.com', password: 'correct-horse-battery' }).expect(201);
    expect(login.body).not.toHaveProperty('password_hash');
    expect(login.body).not.toHaveProperty('passwordHash');
  });

  it('changes a customer password, then rejects login with the old password and accepts the new one', async () => {
    const register = await request(server)
      .post('/auth/customer/register')
      .send({ name: 'Ahmed', email: 'changer@example.com', phone: '0500000001', password: 'old-password-123' })
      .expect(201);
    const token = register.body.token;

    await request(server)
      .post('/auth/customer/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: 'old-password-123', newPassword: 'new-password-456' })
      .expect(201);

    await request(server).post('/auth/customer/login').send({ email: 'changer@example.com', password: 'old-password-123' }).expect(401);
    await request(server).post('/auth/customer/login').send({ email: 'changer@example.com', password: 'new-password-456' }).expect(201);
  });

  it('rejects a change-password attempt with the wrong current password', async () => {
    const register = await request(server)
      .post('/auth/customer/register')
      .send({ name: 'Ahmed', email: 'changer2@example.com', phone: '0500000001', password: 'old-password-123' })
      .expect(201);

    await request(server)
      .post('/auth/customer/change-password')
      .set('Authorization', `Bearer ${register.body.token}`)
      .send({ currentPassword: 'totally-wrong', newPassword: 'new-password-456' })
      .expect(401);
  });

  describe('admin/supplier provisioning (ADMIN_OWNER-gated)', () => {
    const OWNER_ID = 'a1111111-1111-1111-1111-111111111111';
    const OPERATOR_ID = 'a2222222-2222-2222-2222-222222222222';
    const ACCOUNTANT_ID = 'a3333333-3333-3333-3333-333333333333';
    let ownerToken: string;
    let operatorToken: string;
    let accountantToken: string;

    beforeEach(async () => {
      await db
        .insertInto('admin_user')
        .values([
          { id: OWNER_ID, name: 'Khaled Owner', email: 'khaled@apex.sa', role: 'OWNER', mfa_enabled: true },
          { id: OPERATOR_ID, name: 'Maha Operator', email: 'maha@apex.sa', role: 'OPERATOR' },
          { id: ACCOUNTANT_ID, name: 'Sara Accountant', email: 'sara@apex.sa', role: 'ACCOUNTANT', mfa_enabled: true },
        ])
        .execute();
      ownerToken = (await request(server).post('/auth/dev/admin-token').send({ adminId: OWNER_ID, role: 'OWNER' })).body.token;
      operatorToken = (await request(server).post('/auth/dev/admin-token').send({ adminId: OPERATOR_ID, role: 'OPERATOR' })).body.token;
      accountantToken = (await request(server).post('/auth/dev/admin-token').send({ adminId: ACCOUNTANT_ID, role: 'ACCOUNTANT' })).body.token;
    });

    it('lets ADMIN_OWNER create a new admin account, and rejects OPERATOR/ACCOUNTANT from doing so', async () => {
      await request(server)
        .post('/admin/admins')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'New Operator', email: 'new-op@apex.sa', password: 'admin-password-123', role: 'OPERATOR' })
        .expect(201);

      await request(server)
        .post('/admin/admins')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ name: 'Should Fail', email: 'fail1@apex.sa', password: 'admin-password-123', role: 'OPERATOR' })
        .expect(403);

      await request(server)
        .post('/admin/admins')
        .set('Authorization', `Bearer ${accountantToken}`)
        .send({ name: 'Should Fail', email: 'fail2@apex.sa', password: 'admin-password-123', role: 'OPERATOR' })
        .expect(403);
    });

    it('the new admin account can actually log in with the password it was created with', async () => {
      await request(server)
        .post('/admin/admins')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'New Operator', email: 'new-op2@apex.sa', password: 'admin-password-123', role: 'OPERATOR' })
        .expect(201);

      await request(server).post('/auth/admin/login').send({ email: 'new-op2@apex.sa', password: 'admin-password-123' }).expect(201);
    });

    it('lets OWNER and OPERATOR register a new supplier, but rejects ACCOUNTANT', async () => {
      await request(server)
        .post('/admin/suppliers')
        .set('Authorization', `Bearer ${operatorToken}`)
        .send({ legalName: 'Guangzhou Trading Co', contactEmail: 'supplier1@example.com', password: 'supplier-password-123' })
        .expect(201);

      await request(server)
        .post('/admin/suppliers')
        .set('Authorization', `Bearer ${accountantToken}`)
        .send({ legalName: 'Should Fail Co', contactEmail: 'supplier2@example.com', password: 'supplier-password-123' })
        .expect(403);
    });

    it('the new supplier account can log in, and a duplicate contact_email is rejected with 409', async () => {
      await request(server)
        .post('/admin/suppliers')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ legalName: 'Guangzhou Trading Co', contactEmail: 'supplier3@example.com', password: 'supplier-password-123' })
        .expect(201);

      await request(server).post('/auth/supplier/login').send({ email: 'supplier3@example.com', password: 'supplier-password-123' }).expect(201);

      await request(server)
        .post('/admin/suppliers')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ legalName: 'Another Co', contactEmail: 'supplier3@example.com', password: 'another-password' })
        .expect(409);
    });
  });
});
