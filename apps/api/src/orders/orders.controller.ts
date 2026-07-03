import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
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

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

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
