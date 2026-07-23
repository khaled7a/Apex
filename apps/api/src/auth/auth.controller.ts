import { Body, Controller, ForbiddenException, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AdminJwtRole } from './jwt-payload.types';
import { Public } from './decorators/public.decorator';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { ConsumeSsoCodeDto } from './dto/consume-sso-code.dto';
import { CustomerAuthGuard } from './guards/customer-auth.guard';
import { SupplierAuthGuard } from './guards/supplier-auth.guard';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import { RequestWithActor } from './request-with-actor';

function assertNotProduction() {
  if (process.env.NODE_ENV === 'production') {
    throw new ForbiddenException('dev token issuance is disabled outside development/testing');
  }
}

@ApiTags('auth (dev-only token issuance)')
@Controller('auth/dev')
@Public()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('customer-token')
  issueCustomerToken(@Body('customerId') customerId: string) {
    assertNotProduction();
    return { token: this.auth.issueCustomerToken(customerId) };
  }

  @Post('supplier-token')
  issueSupplierToken(@Body('supplierId') supplierId: string) {
    assertNotProduction();
    return { token: this.auth.issueSupplierToken(supplierId) };
  }

  @Post('admin-token')
  issueAdminToken(@Body('adminId') adminId: string, @Body('role') role: AdminJwtRole) {
    assertNotProduction();
    return { token: this.auth.issueAdminToken(adminId, role) };
  }
}

@ApiTags('auth')
@Controller('auth')
export class RealAuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('customer/register')
  @Public()
  registerCustomer(@Body() dto: RegisterCustomerDto) {
    return this.auth.registerCustomer(dto);
  }

  @Post('customer/login')
  @Public()
  loginCustomer(@Body() dto: LoginDto) {
    return this.auth.loginCustomer(dto.email, dto.password);
  }

  @Post('supplier/login')
  @Public()
  loginSupplier(@Body() dto: LoginDto) {
    return this.auth.loginSupplier(dto.email, dto.password);
  }

  @Post('admin/login')
  @Public()
  loginAdmin(@Body() dto: LoginDto) {
    return this.auth.loginAdmin(dto.email, dto.password);
  }

  @Post('customer/refresh')
  @Public()
  refreshCustomerToken(@Body() dto: RefreshTokenDto) {
    return this.auth.refresh('CUSTOMER', dto.refreshToken);
  }

  @Post('supplier/refresh')
  @Public()
  refreshSupplierToken(@Body() dto: RefreshTokenDto) {
    return this.auth.refresh('SUPPLIER', dto.refreshToken);
  }

  @Post('admin/refresh')
  @Public()
  refreshAdminToken(@Body() dto: RefreshTokenDto) {
    return this.auth.refresh('ADMIN', dto.refreshToken);
  }

  /**
   * Called by each portal's own src/app/sso/route.ts (a server-to-server
   * Route Handler, never the browser directly) after the unified
   * login/landing page (apps/web-landing) redirects here with a one-time
   * code — see AuthService.consumeSsoHandoffCode for why nothing sensitive
   * ever traveled through that redirect URL.
   */
  @Post('sso/consume')
  @Public()
  consumeSso(@Body() dto: ConsumeSsoCodeDto) {
    return this.auth.consumeSsoHandoffCode(dto.actorType, dto.code);
  }

  /** No auth guard needed — knowing the raw refresh-token value is itself sufficient to revoke it, matching a logged-out session that may already carry an expired access token. */
  @Post('customer/logout')
  @Public()
  async logoutCustomer(@Body() dto: RefreshTokenDto) {
    await this.auth.logout('CUSTOMER', dto.refreshToken);
    return { ok: true };
  }

  @Post('supplier/logout')
  @Public()
  async logoutSupplier(@Body() dto: RefreshTokenDto) {
    await this.auth.logout('SUPPLIER', dto.refreshToken);
    return { ok: true };
  }

  @Post('admin/logout')
  @Public()
  async logoutAdmin(@Body() dto: RefreshTokenDto) {
    await this.auth.logout('ADMIN', dto.refreshToken);
    return { ok: true };
  }

  @Post('customer/change-password')
  @ApiBearerAuth()
  @UseGuards(CustomerAuthGuard)
  async changeCustomerPassword(@Req() req: RequestWithActor, @Body() dto: ChangePasswordDto) {
    await this.auth.changeCustomerPassword(req.actor!.id!, dto.currentPassword, dto.newPassword);
    return { ok: true };
  }

  @Post('supplier/change-password')
  @ApiBearerAuth()
  @UseGuards(SupplierAuthGuard)
  async changeSupplierPassword(@Req() req: RequestWithActor, @Body() dto: ChangePasswordDto) {
    await this.auth.changeSupplierPassword(req.actor!.id!, dto.currentPassword, dto.newPassword);
    return { ok: true };
  }

  @Post('admin/change-password')
  @ApiBearerAuth()
  @UseGuards(AdminAuthGuard)
  async changeAdminPassword(@Req() req: RequestWithActor, @Body() dto: ChangePasswordDto) {
    await this.auth.changeAdminPassword(req.actor!.id!, dto.currentPassword, dto.newPassword);
    return { ok: true };
  }

  /** AdminJwtStrategy only decodes {role, id} — the portal header ("مرحباً، فلان") needs a real profile fetch. */
  @Get('admin/me')
  @ApiBearerAuth()
  @UseGuards(AdminAuthGuard)
  adminMe(@Req() req: RequestWithActor) {
    return this.auth.getAdminProfile(req.actor!.id!);
  }

  @Post('customer/forgot-password')
  @Public()
  async forgotCustomerPassword(@Body() dto: ForgotPasswordDto) {
    await this.auth.forgotPassword('CUSTOMER', dto.email);
    return { ok: true };
  }

  @Post('supplier/forgot-password')
  @Public()
  async forgotSupplierPassword(@Body() dto: ForgotPasswordDto) {
    await this.auth.forgotPassword('SUPPLIER', dto.email);
    return { ok: true };
  }

  @Post('admin/forgot-password')
  @Public()
  async forgotAdminPassword(@Body() dto: ForgotPasswordDto) {
    await this.auth.forgotPassword('ADMIN', dto.email);
    return { ok: true };
  }

  @Post('customer/reset-password')
  @Public()
  async resetCustomerPassword(@Body() dto: ResetPasswordDto) {
    await this.auth.resetPassword('CUSTOMER', dto.token, dto.newPassword);
    return { ok: true };
  }

  @Post('supplier/reset-password')
  @Public()
  async resetSupplierPassword(@Body() dto: ResetPasswordDto) {
    await this.auth.resetPassword('SUPPLIER', dto.token, dto.newPassword);
    return { ok: true };
  }

  @Post('admin/reset-password')
  @Public()
  async resetAdminPassword(@Body() dto: ResetPasswordDto) {
    await this.auth.resetPassword('ADMIN', dto.token, dto.newPassword);
    return { ok: true };
  }
}
