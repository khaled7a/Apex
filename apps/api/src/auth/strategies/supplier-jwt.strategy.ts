import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ConfigService } from '@nestjs/config';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AppConfig } from '../../config/configuration';
import { SupplierJwtPayload } from '../jwt-payload.types';

@Injectable()
export class SupplierJwtStrategy extends PassportStrategy(Strategy, 'jwt-supplier') {
  constructor(config: ConfigService<AppConfig, true>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get('jwt.supplierSecret', { infer: true }),
      audience: 'supplier',
    });
  }

  validate(payload: SupplierJwtPayload) {
    return { role: 'SUPPLIER' as const, id: payload.sub };
  }
}
