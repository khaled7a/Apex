import { BadRequestException, ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'node:crypto';
import { Kysely } from 'kysely';
import { KYSELY } from '../database/database.module';
import { DB } from '../database/db.types';
import { UnitOfWork } from '../database/unit-of-work';
import { AppConfig } from '../config/configuration';
import { AdminJwtRole } from './jwt-payload.types';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { EmailProvider } from '../notifications/providers/email.provider';

const BCRYPT_ROUNDS = 12;
const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

export type ResetPasswordActorType = 'CUSTOMER' | 'SUPPLIER' | 'ADMIN';

/**
 * DEV-ONLY token issuance (issue*Token below) mints a JWT for an *existing*
 * customer/supplier/admin id without checking a password — kept for the
 * integration test suite, disabled outside development via
 * auth.controller.ts's assertNotProduction(). Real credential-based login
 * (register/login/changePassword below) was added alongside it, not instead
 * of it, since switching the whole test suite to real login would mean
 * hashing a password in every single test fixture for no additional signal.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
    @Inject(KYSELY) private readonly db: Kysely<DB>,
    private readonly uow: UnitOfWork,
    private readonly emailProvider: EmailProvider,
  ) {}

  issueCustomerToken(customerId: string): string {
    return this.jwt.sign(
      { sub: customerId, aud: 'customer' },
      { secret: this.config.get('jwt.customerSecret', { infer: true }), expiresIn: '12h' },
    );
  }

  issueSupplierToken(supplierId: string): string {
    return this.jwt.sign(
      { sub: supplierId, aud: 'supplier' },
      { secret: this.config.get('jwt.supplierSecret', { infer: true }), expiresIn: '12h' },
    );
  }

  issueAdminToken(adminId: string, role: AdminJwtRole): string {
    return this.jwt.sign(
      { sub: adminId, aud: 'admin', role },
      { secret: this.config.get('jwt.adminSecret', { infer: true }), expiresIn: '12h' },
    );
  }

  async registerCustomer(dto: RegisterCustomerDto): Promise<{ token: string }> {
    const trx = this.uow.getClient();
    const existing = await trx.selectFrom('customer').select(['id']).where('email', '=', dto.email).executeTakeFirst();
    if (existing) {
      throw new ConflictException('a customer with this email already exists');
    }
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const created = await trx
      .insertInto('customer')
      .values({
        name: dto.name,
        email: dto.email,
        phone: dto.phone,
        password_hash: passwordHash,
        company_name: dto.companyName ?? null,
        cr_number: dto.crNumber ?? null,
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    return { token: this.issueCustomerToken(created.id) };
  }

  async loginCustomer(email: string, password: string): Promise<{ token: string }> {
    const trx = this.uow.getClient();
    const customer = await trx.selectFrom('customer').select(['id', 'password_hash']).where('email', '=', email).executeTakeFirst();
    await this.assertPasswordMatches(customer?.password_hash ?? null, password);
    return { token: this.issueCustomerToken(customer!.id) };
  }

  async loginSupplier(email: string, password: string): Promise<{ token: string }> {
    const trx = this.uow.getClient();
    const supplier = await trx
      .selectFrom('registered_supplier')
      .select(['id', 'password_hash', 'is_active'])
      .where('contact_email', '=', email)
      .executeTakeFirst();
    await this.assertPasswordMatches(supplier?.is_active === false ? null : (supplier?.password_hash ?? null), password);
    return { token: this.issueSupplierToken(supplier!.id) };
  }

  async loginAdmin(email: string, password: string): Promise<{ token: string }> {
    const trx = this.uow.getClient();
    const admin = await trx.selectFrom('admin_user').select(['id', 'password_hash', 'role', 'is_active']).where('email', '=', email).executeTakeFirst();
    await this.assertPasswordMatches(admin?.is_active === false ? null : (admin?.password_hash ?? null), password);
    return { token: this.issueAdminToken(admin!.id, admin!.role) };
  }

  async changeCustomerPassword(customerId: string, currentPassword: string, newPassword: string): Promise<void> {
    const trx = this.uow.getClient();
    const customer = await trx.selectFrom('customer').select(['password_hash']).where('id', '=', customerId).executeTakeFirstOrThrow();
    await this.assertPasswordMatches(customer.password_hash, currentPassword);
    await trx.updateTable('customer').set({ password_hash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS) }).where('id', '=', customerId).execute();
  }

  async changeSupplierPassword(supplierId: string, currentPassword: string, newPassword: string): Promise<void> {
    const trx = this.uow.getClient();
    const supplier = await trx.selectFrom('registered_supplier').select(['password_hash']).where('id', '=', supplierId).executeTakeFirstOrThrow();
    await this.assertPasswordMatches(supplier.password_hash, currentPassword);
    await trx.updateTable('registered_supplier').set({ password_hash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS) }).where('id', '=', supplierId).execute();
  }

  async changeAdminPassword(adminId: string, currentPassword: string, newPassword: string): Promise<void> {
    const trx = this.uow.getClient();
    const admin = await trx.selectFrom('admin_user').select(['password_hash']).where('id', '=', adminId).executeTakeFirstOrThrow();
    await this.assertPasswordMatches(admin.password_hash, currentPassword);
    await trx.updateTable('admin_user').set({ password_hash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS) }).where('id', '=', adminId).execute();
  }

  /** ADMIN_OWNER-only provisioning — see admin.controller.ts. */
  async createAdmin(dto: CreateAdminDto): Promise<{ id: string }> {
    const trx = this.uow.getClient();
    const existing = await trx.selectFrom('admin_user').select(['id']).where('email', '=', dto.email).executeTakeFirst();
    if (existing) {
      throw new ConflictException('an admin with this email already exists');
    }
    const created = await trx
      .insertInto('admin_user')
      .values({
        name: dto.name,
        email: dto.email,
        password_hash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
        role: dto.role,
        // mfa_required_for_sensitive_roles CHECK constraint requires this for OWNER/ACCOUNTANT —
        // real MFA enrollment isn't built, so this only unblocks account creation, it does not
        // mean MFA is actually enforced anywhere yet.
        mfa_enabled: dto.role === 'OWNER' || dto.role === 'ACCOUNTANT',
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    return { id: created.id };
  }

  /** ADMIN_OWNER/ADMIN_OPERATOR provisioning — see admin.controller.ts. */
  async createSupplier(dto: CreateSupplierDto): Promise<{ id: string }> {
    const trx = this.uow.getClient();
    const existing = await trx
      .selectFrom('registered_supplier')
      .select(['id'])
      .where('contact_email', '=', dto.contactEmail)
      .executeTakeFirst();
    if (existing) {
      throw new ConflictException('a supplier with this contact email already exists');
    }
    const created = await trx
      .insertInto('registered_supplier')
      .values({
        legal_name: dto.legalName,
        contact_email: dto.contactEmail,
        whatsapp_phone: dto.whatsappPhone ?? null,
        password_hash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
      })
      .returning('id')
      .executeTakeFirstOrThrow();
    return { id: created.id };
  }

  /** Never selects password_hash — used by GET /admin/admins for both the accounts screen and the four-eyes approver picker. */
  async listAdmins() {
    const trx = this.uow.getClient();
    return trx
      .selectFrom('admin_user')
      .select(['id', 'name', 'email', 'role', 'is_active', 'mfa_enabled', 'created_at'])
      .orderBy('created_at', 'asc')
      .execute();
  }

  async listSuppliers() {
    const trx = this.uow.getClient();
    return trx
      .selectFrom('registered_supplier')
      .select(['id', 'legal_name', 'contact_email', 'whatsapp_phone', 'is_active', 'created_at'])
      .orderBy('created_at', 'asc')
      .execute();
  }

  /** AdminJwtStrategy only decodes {role, id} from the token — the portal header and the "exclude myself" approver-picker logic both need a real name, not a JWT guess. */
  async getAdminProfile(adminId: string) {
    const trx = this.uow.getClient();
    return trx
      .selectFrom('admin_user')
      .select(['id', 'name', 'email', 'role', 'is_active'])
      .where('id', '=', adminId)
      .executeTakeFirstOrThrow();
  }

  /**
   * Two distinct real lockout vectors, not one: (a) an OWNER cannot
   * deactivate *themselves* even if other OWNERs exist — a same-request
   * footgun with no upside; (b) nobody can deactivate the *last* active
   * OWNER, full stop, since ADMIN_ACCOUNT_MANAGE is OWNER-only — losing the
   * last one means no one left who can create/reactivate any admin account
   * without a manual DB fix.
   */
  async setAdminActive(targetId: string, actorId: string, isActive: boolean): Promise<void> {
    const trx = this.uow.getClient();
    if (!isActive) {
      if (targetId === actorId) {
        throw new BadRequestException('لا يمكنك إلغاء تفعيل حسابك الخاص');
      }
      const target = await trx.selectFrom('admin_user').select(['role', 'is_active']).where('id', '=', targetId).executeTakeFirstOrThrow();
      if (target.role === 'OWNER' && target.is_active) {
        const activeOwners = await trx
          .selectFrom('admin_user')
          .select((eb) => eb.fn.countAll().as('count'))
          .where('role', '=', 'OWNER')
          .where('is_active', '=', true)
          .executeTakeFirstOrThrow();
        if (Number(activeOwners.count) <= 1) {
          throw new BadRequestException('لا يمكن إلغاء تفعيل آخر حساب OWNER نشط — سيؤدي ذلك إلى فقدان القدرة على إدارة الحسابات');
        }
      }
    }
    await trx.updateTable('admin_user').set({ is_active: isActive }).where('id', '=', targetId).execute();
  }

  /** No self-lockout risk here — supplier accounts aren't part of the RBAC-management chain, there's always an admin able to reactivate one. */
  async setSupplierActive(targetId: string, isActive: boolean): Promise<void> {
    const trx = this.uow.getClient();
    await trx.updateTable('registered_supplier').set({ is_active: isActive }).where('id', '=', targetId).execute();
  }

  /**
   * Always resolves the same way regardless of whether the email matched
   * anything — no signal is ever returned that would let a caller enumerate
   * which emails have accounts. Sends via EmailProvider directly (not
   * NotificationsService, which is hard-wired to order-transition events).
   */
  async forgotPassword(actorType: ResetPasswordActorType, email: string): Promise<void> {
    const trx = this.uow.getClient();
    const actor = await this.findActiveActorByEmail(actorType, email);
    if (actor) {
      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');
      await trx
        .insertInto('password_reset_token')
        .values({
          actor_type: actorType,
          actor_id: actor.id,
          token_hash: tokenHash,
          expires_at: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        })
        .execute();

      const origins = this.config.get('resetLinkOrigins', { infer: true });
      const origin = actorType === 'CUSTOMER' ? origins.customer : actorType === 'SUPPLIER' ? origins.supplier : origins.admin;
      const link = `${origin}/reset-password?token=${rawToken}`;
      await this.emailProvider.send(email, `لإعادة تعيين كلمة المرور، افتح الرابط التالي (صالح لمدة 30 دقيقة): ${link}`);
    }
  }

  async resetPassword(actorType: ResetPasswordActorType, token: string, newPassword: string): Promise<void> {
    const trx = this.uow.getClient();
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const row = await trx
      .selectFrom('password_reset_token')
      .selectAll()
      .where('token_hash', '=', tokenHash)
      .where('actor_type', '=', actorType)
      .executeTakeFirst();
    if (!row || row.used_at || row.expires_at < new Date()) {
      throw new BadRequestException('رمز إعادة التعيين غير صالح أو منتهي الصلاحية');
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
    const table = actorType === 'CUSTOMER' ? 'customer' : actorType === 'SUPPLIER' ? 'registered_supplier' : 'admin_user';
    await trx.updateTable(table).set({ password_hash: passwordHash }).where('id', '=', row.actor_id).execute();
    await trx.updateTable('password_reset_token').set({ used_at: new Date() }).where('id', '=', row.id).execute();
  }

  /** Deactivated admin/supplier accounts can't reset their way back into a working password — consistent with loginAdmin/loginSupplier's own is_active treatment. */
  private async findActiveActorByEmail(actorType: ResetPasswordActorType, email: string): Promise<{ id: string } | undefined> {
    const trx = this.uow.getClient();
    if (actorType === 'CUSTOMER') {
      return trx.selectFrom('customer').select(['id']).where('email', '=', email).executeTakeFirst();
    }
    if (actorType === 'SUPPLIER') {
      return trx
        .selectFrom('registered_supplier')
        .select(['id'])
        .where('contact_email', '=', email)
        .where('is_active', '=', true)
        .executeTakeFirst();
    }
    return trx.selectFrom('admin_user').select(['id']).where('email', '=', email).where('is_active', '=', true).executeTakeFirst();
  }

  /**
   * Constant-shape failure: whether the account doesn't exist, is inactive,
   * has no password set yet, or the password itself is wrong, this always
   * throws the same generic 401 — never reveals which case it was.
   */
  private async assertPasswordMatches(hash: string | null, candidate: string): Promise<void> {
    const matches = hash ? await bcrypt.compare(candidate, hash) : false;
    if (!matches) {
      throw new UnauthorizedException('invalid email or password');
    }
  }
}
