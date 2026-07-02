import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppConfig } from '../../config/configuration';
import { AdminJwtPayload } from '../jwt-payload.types';

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'jwt-admin') {
  constructor(config: ConfigService<AppConfig, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get('jwt.adminSecret', { infer: true }),
      audience: 'admin',
    });
  }

  validate(payload: AdminJwtPayload) {
    const role = `ADMIN_${payload.role}` as const;
    return { role, id: payload.sub };
  }
}
