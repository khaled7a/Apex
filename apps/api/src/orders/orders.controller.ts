import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { ApproveOrderDto } from './dto/approve-order.dto';
import { CustomerAuthGuard } from '../auth/guards/customer-auth.guard';
import { SupplierAuthGuard } from '../auth/guards/supplier-auth.guard';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { PermissionMatrixGuard } from '../auth/guards/permission-matrix.guard';
import { RequiresPermission } from '../auth/decorators/requires-permission.decorator';
import { RequestWithActor } from '../auth/request-with-actor';
import { AuditLogService } from '../audit/audit-log.service';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly auditLog: AuditLogService,
  ) {}

  @Post()
  @UseGuards(CustomerAuthGuard)
  create(@Req() req: RequestWithActor, @Body() dto: CreateOrderDto) {
    return this.orders.createDraft(req.actor!.id!, dto.serviceTypeCode);
  }

  // Must be registered before ':id' below — otherwise Nest/Express would
  // match GET /orders/me as ':id'='me' under AdminAuthGuard instead, which a
  // customer's own bearer token would fail.
  @Get('me')
  @UseGuards(CustomerAuthGuard)
  listMine(@Req() req: RequestWithActor) {
    return this.orders.listMine(req.actor!.id!);
  }

  @Get('assigned-to-me')
  @UseGuards(SupplierAuthGuard)
  listAssignedToSupplier(@Req() req: RequestWithActor) {
    return this.orders.listAssignedToSupplier(req.actor!.id!);
  }

  /** Admin-wide browse/search — before this there was no way to find an order without already knowing its id. */
  @Get()
  @UseGuards(AdminAuthGuard)
  listAll(
    @Query('state') state?: string,
    @Query('holdType') holdType?: string,
    @Query('customerId') customerId?: string,
    @Query('supplierId') supplierId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.orders.listAll({
      state,
      holdType,
      customerId,
      supplierId,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    });
  }

  @Get('queue/needs-admin-action')
  @UseGuards(AdminAuthGuard)
  listNeedsAdminAction() {
    return this.orders.listNeedsAdminAction();
  }

  @Get(':id')
  @UseGuards(AdminAuthGuard)
  get(@Param('id') id: string) {
    return this.orders.get(id);
  }

  @Get(':id/detail')
  @UseGuards(CustomerAuthGuard)
  getDetail(@Req() req: RequestWithActor, @Param('id') id: string) {
    return this.orders.getDetailForCustomer(id, req.actor!.id!);
  }

  @Get(':id/detail-for-supplier')
  @UseGuards(SupplierAuthGuard)
  getDetailForSupplier(@Req() req: RequestWithActor, @Param('id') id: string) {
    return this.orders.getDetailForSupplier(id, req.actor!.id!);
  }

  @Get(':id/detail-for-admin')
  @UseGuards(AdminAuthGuard)
  getDetailForAdmin(@Param('id') id: string) {
    return this.orders.getDetailForAdmin(id);
  }

  @Get(':id/audit-log')
  @UseGuards(AdminAuthGuard)
  getAuditLog(@Param('id') id: string) {
    return this.auditLog.listForOrder(id);
  }

  @Post(':id/submit')
  @UseGuards(CustomerAuthGuard)
  submit(@Req() req: RequestWithActor, @Param('id') id: string, @Body('expectedStateVersion') expectedStateVersion: number) {
    return this.orders.submit(id, req.actor!, expectedStateVersion);
  }

  @Post(':id/confirm-deposit')
  @UseGuards(AdminAuthGuard)
  confirmDeposit(@Param('id') id: string, @Body('expectedStateVersion') expectedStateVersion: number) {
    return this.orders.confirmDeposit(id, expectedStateVersion);
  }

  @Post(':id/request-edit')
  @UseGuards(AdminAuthGuard, PermissionMatrixGuard)
  @RequiresPermission('ORDER_APPROVE_EDIT_REJECT')
  requestEdit(@Req() req: RequestWithActor, @Param('id') id: string, @Body('expectedStateVersion') expectedStateVersion: number) {
    return this.orders.requestEdit(id, req.actor!, expectedStateVersion);
  }

  @Post(':id/resubmit')
  @UseGuards(CustomerAuthGuard)
  resubmit(@Req() req: RequestWithActor, @Param('id') id: string, @Body('expectedStateVersion') expectedStateVersion: number) {
    return this.orders.resubmit(id, req.actor!, expectedStateVersion);
  }

  @Post(':id/reject')
  @UseGuards(AdminAuthGuard, PermissionMatrixGuard)
  @RequiresPermission('ORDER_APPROVE_EDIT_REJECT')
  reject(@Req() req: RequestWithActor, @Param('id') id: string, @Body('expectedStateVersion') expectedStateVersion: number) {
    return this.orders.reject(id, req.actor!, expectedStateVersion);
  }

  @Post(':id/approve')
  @UseGuards(AdminAuthGuard, PermissionMatrixGuard)
  @RequiresPermission('ORDER_APPROVE_EDIT_REJECT')
  approve(@Req() req: RequestWithActor, @Param('id') id: string, @Body() dto: ApproveOrderDto) {
    return this.orders.approveAndRoute(id, req.actor!, dto);
  }
}
