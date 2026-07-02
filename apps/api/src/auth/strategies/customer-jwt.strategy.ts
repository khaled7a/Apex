import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppConfig } from '../../config/configuration';
import { CustomerJwtPayload } from '../jwt-payload.types';

@Injectable()
export class CustomerJwtStrategy extends PassportStrategy(Strategy, 'jwt-customer') {
  constructor(config: ConfigService<AppConfig, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get('jwt.customerSecret', { infer: true }),
      audience: 'customer',
    });
  }

  validate(payload: CustomerJwtPayload) {
    return { role: 'CUSTOMER' as const, id: payload.sub };
  }
}
