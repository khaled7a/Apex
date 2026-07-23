import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { CustomerJwtStrategy } from './strategies/customer-jwt.strategy';
import { SupplierJwtStrategy } from './strategies/supplier-jwt.strategy';
import { AdminJwtStrategy } from './strategies/admin-jwt.strategy';
import { AuthService } from './auth.service';
import { AuthController, RealAuthController } from './auth.controller';
import { AccountProvisioningController } from './account-provisioning.controller';
import { CustomerAuthGuard } from './guards/customer-auth.guard';
import { SupplierAuthGuard } from './guards/supplier-auth.guard';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import { AnyActorAuthGuard } from './guards/any-actor-auth.guard';
import { PermissionMatrixGuard } from './guards/permission-matrix.guard';

@Global()
@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController, RealAuthController, AccountProvisioningController],
  providers: [
    AuthService,
    CustomerJwtStrategy,
    SupplierJwtStrategy,
    AdminJwtStrategy,
    CustomerAuthGuard,
    SupplierAuthGuard,
    AdminAuthGuard,
    AnyActorAuthGuard,
    PermissionMatrixGuard,
  ],
  exports: [AuthService, CustomerAuthGuard, SupplierAuthGuard, AdminAuthGuard, AnyActorAuthGuard, PermissionMatrixGuard],
})
export class AuthModule {}
