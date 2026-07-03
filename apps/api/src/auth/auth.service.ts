import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import bcrypt from 'bcrypt';
import { Kysely } from 'kysely';
import { KYSELY } from '../database/database.module';
import { DB } from '../database/db.types';
import { UnitOfWork } from '../database/unit-of-work';
import { AppConfig } from '../config/configuration';
import { AdminJwtRole } from './jwt-payload.types';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { CreateAdminDto } from './dto/create-admin.dto';
import { CreateSupplierDto } from './dto/create-supplier.dto';

const BCRYPT_ROUNDS = 12;

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
      .select(['id', 'password_hash'])
      .where('contact_email', '=', email)
      .executeTakeFirst();
    await this.assertPasswordMatches(supplier?.password_hash ?? null, password);
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
