import { Body, Controller, ForbiddenException, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AdminJwtRole } from './jwt-payload.types';
import { Public } from './decorators/public.decorator';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
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
}
