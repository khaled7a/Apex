import { Body, Controller, ForbiddenException, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { isActionAllowed } from '@apex/domain';
import { AuthService } from './auth.service';
import { AdminAuthGuard } from './guards/admin-auth.guard';
import { RequestWithActor } from './request-with-actor';
import { CreateAdminDto } from './dto/create-admin.dto';
import { CreateSupplierDto } from './dto/create-supplier.dto';

/**
 * Neither admins nor suppliers self-register (unlike customers) — accounts
 * are provisioned by an existing admin, gated by the same PERMISSION_MATRIX
 * used everywhere else in packages/domain rather than an ad hoc role check.
 */
@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin')
@UseGuards(AdminAuthGuard)
export class AccountProvisioningController {
  constructor(private readonly auth: AuthService) {}

  @Post('admins')
  createAdmin(@Req() req: RequestWithActor, @Body() dto: CreateAdminDto) {
    if (!isActionAllowed('ADMIN_ACCOUNT_MANAGE', req.actor!.role)) {
      throw new ForbiddenException('only ADMIN_OWNER can create admin accounts');
    }
    return this.auth.createAdmin(dto);
  }

  @Post('suppliers')
  createSupplier(@Req() req: RequestWithActor, @Body() dto: CreateSupplierDto) {
    if (!isActionAllowed('SUPPLIER_ACCOUNT_MANAGE', req.actor!.role)) {
      throw new ForbiddenException('only ADMIN_OWNER/ADMIN_OPERATOR can register a new supplier');
    }
    return this.auth.createSupplier(dto);
  }
}
