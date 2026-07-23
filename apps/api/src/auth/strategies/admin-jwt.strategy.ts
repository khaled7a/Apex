import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Kysely } from 'kysely';
import { AppConfig } from '../../config/configuration';
import { AdminJwtPayload } from '../jwt-payload.types';
import { KYSELY } from '../../database/database.module';
import { DB } from '../../database/db.types';

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'jwt-admin') {
  constructor(
    config: ConfigService<AppConfig, true>,
    @Inject(KYSELY) private readonly db: Kysely<DB>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get('jwt.adminSecret', { infer: true }),
      audience: 'admin',
    });
  }

  async validate(payload: AdminJwtPayload) {
    const admin = await this.db
      .selectFrom('admin_user')
      .select('is_active')
      .where('id', '=', payload.sub)
      .executeTakeFirst();
    if (!admin?.is_active) throw new UnauthorizedException();
    const role = `ADMIN_${payload.role}` as const;
    return { role, id: payload.sub };
  }
}
