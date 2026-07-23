import { Body, Controller, ForbiddenException, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
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

  /** Any authenticated admin — needed by the four-eyes approver-picker regardless of the caller's own role. */
  @Get('admins')
  listAdmins() {
    return this.auth.listAdmins();
  }

  @Get('suppliers')
  listSuppliers() {
    return this.auth.listSuppliers();
  }

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

  @Post('admins/:id/deactivate')
  deactivateAdmin(@Req() req: RequestWithActor, @Param('id') id: string) {
    if (!isActionAllowed('ADMIN_ACCOUNT_MANAGE', req.actor!.role)) {
      throw new ForbiddenException('only ADMIN_OWNER can manage admin accounts');
    }
    return this.auth.setAdminActive(id, req.actor!.id!, false);
  }

  @Post('admins/:id/reactivate')
  reactivateAdmin(@Req() req: RequestWithActor, @Param('id') id: string) {
    if (!isActionAllowed('ADMIN_ACCOUNT_MANAGE', req.actor!.role)) {
      throw new ForbiddenException('only ADMIN_OWNER can manage admin accounts');
    }
    return this.auth.setAdminActive(id, req.actor!.id!, true);
  }

  @Post('suppliers/:id/deactivate')
  deactivateSupplier(@Req() req: RequestWithActor, @Param('id') id: string) {
    if (!isActionAllowed('SUPPLIER_ACCOUNT_MANAGE', req.actor!.role)) {
      throw new ForbiddenException('only ADMIN_OWNER/ADMIN_OPERATOR can manage supplier accounts');
    }
    return this.auth.setSupplierActive(id, false);
  }

  @Post('suppliers/:id/reactivate')
  reactivateSupplier(@Req() req: RequestWithActor, @Param('id') id: string) {
    if (!isActionAllowed('SUPPLIER_ACCOUNT_MANAGE', req.actor!.role)) {
      throw new ForbiddenException('only ADMIN_OWNER/ADMIN_OPERATOR can manage supplier accounts');
    }
    return this.auth.setSupplierActive(id, true);
  }
}
