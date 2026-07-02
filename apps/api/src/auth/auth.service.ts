import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AppConfig } from '../config/configuration';
import { AdminJwtRole } from './jwt-payload.types';

/**
 * DEV-ONLY token issuance: mints a JWT for an *existing* customer/supplier/
 * admin id without checking a password. This reference implementation does
 * not include a real credential/login system (bcrypt password hashing,
 * MFA enrollment, session revocation) — that is a distinct piece of work
 * left for a follow-up, not something the v1 scope promised. Do not expose
 * these endpoints outside local development.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
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
}
