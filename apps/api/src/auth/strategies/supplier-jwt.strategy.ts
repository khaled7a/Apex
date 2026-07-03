import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Kysely } from 'kysely';
import { AppConfig } from '../../config/configuration';
import { SupplierJwtPayload } from '../jwt-payload.types';
import { KYSELY } from '../../database/database.module';
import { DB } from '../../database/db.types';

@Injectable()
export class SupplierJwtStrategy extends PassportStrategy(Strategy, 'jwt-supplier') {
  constructor(
    config: ConfigService<AppConfig, true>,
    @Inject(KYSELY) private readonly db: Kysely<DB>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get('jwt.supplierSecret', { infer: true }),
      audience: 'supplier',
    });
  }

  async validate(payload: SupplierJwtPayload) {
    const supplier = await this.db
      .selectFrom('registered_supplier')
      .select('is_active')
      .where('id', '=', payload.sub)
      .executeTakeFirst();
    if (!supplier?.is_active) throw new UnauthorizedException();
    return { role: 'SUPPLIER' as const, id: payload.sub };
  }
}
