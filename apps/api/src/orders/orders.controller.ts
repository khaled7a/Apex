import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { ApproveOrderDto } from './dto/approve-order.dto';
import { CustomerAuthGuard } from '../auth/guards/customer-auth.guard';
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

  @Get(':id')
  @UseGuards(AdminAuthGuard)
  get(@Param('id') id: string) {
    return this.orders.get(id);
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
