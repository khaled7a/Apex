import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { CustomerJwtStrategy } from './strategies/customer-jwt.strategy';
import { SupplierJwtStrategy } from './strategies/supplier-jwt.strategy';
import { AdminJwtStrategy } from './strategies/admin-jwt.strategy';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { CustomerAuthGuard } from './guards/customer-auth.guard';
import { SupplierAuthGuard } from './guards/supplier-auth.guard';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import { PermissionMatrixGuard } from './guards/permission-matrix.guard';

@Global()
@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthService,
    CustomerJwtStrategy,
    SupplierJwtStrategy,
    AdminJwtStrategy,
    CustomerAuthGuard,
    SupplierAuthGuard,
    AdminAuthGuard,
    PermissionMatrixGuard,
  ],
  exports: [AuthService, CustomerAuthGuard, SupplierAuthGuard, AdminAuthGuard, PermissionMatrixGuard],
})
export class AuthModule {}
