import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DisputesService } from './disputes.service';
import { OpenDisputeDto } from './dto/open-dispute.dto';
import { ResolveMandatoryRefundDto } from './dto/resolve-mandatory-refund.dto';
import { CustomerAuthGuard } from '../auth/guards/customer-auth.guard';
import { SupplierAuthGuard } from '../auth/guards/supplier-auth.guard';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { PermissionMatrixGuard } from '../auth/guards/permission-matrix.guard';
import { RequiresPermission } from '../auth/decorators/requires-permission.decorator';
import { RequestWithActor } from '../auth/request-with-actor';

@ApiTags('disputes')
@ApiBearerAuth()
@Controller('disputes')
export class DisputesController {
  constructor(private readonly disputes: DisputesService) {}

  @Post(':orderId/open/customer')
  @UseGuards(CustomerAuthGuard)
  openAsCustomer(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body() dto: OpenDisputeDto) {
    return this.disputes.openDispute(orderId, req.actor!, dto.event, dto.expectedStateVersion);
  }

  @Post(':orderId/open/supplier')
  @UseGuards(SupplierAuthGuard)
  openAsSupplier(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body() dto: OpenDisputeDto) {
    return this.disputes.openDispute(orderId, req.actor!, dto.event, dto.expectedStateVersion);
  }

  @Post(':orderId/open/admin')
  @UseGuards(AdminAuthGuard)
  openAsAdmin(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body() dto: OpenDisputeDto) {
    return this.disputes.openDispute(orderId, req.actor!, dto.event, dto.expectedStateVersion);
  }

  @Post(':orderId/resolve')
  @UseGuards(AdminAuthGuard, PermissionMatrixGuard)
  @RequiresPermission('DISPUTE_RESOLVE_ORDINARY')
  resolve(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body('expectedStateVersion') expectedStateVersion: number) {
    return this.disputes.resolveOrdinaryDispute(orderId, req.actor!, expectedStateVersion);
  }

  @Post(':orderId/mark-unresolved')
  @UseGuards(AdminAuthGuard, PermissionMatrixGuard)
  @RequiresPermission('DISPUTE_RESOLVE_ORDINARY')
  markUnresolved(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body('expectedStateVersion') expectedStateVersion: number) {
    return this.disputes.markUnresolved(orderId, req.actor!, expectedStateVersion);
  }

  @Post(':orderId/admin-cancel')
  @UseGuards(AdminAuthGuard, PermissionMatrixGuard)
  @RequiresPermission('DISPUTE_RESOLVE_ORDINARY')
  adminCancel(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body('expectedStateVersion') expectedStateVersion: number) {
    return this.disputes.adminCancelOrder(orderId, req.actor!, expectedStateVersion);
  }

  @Post(':orderId/mandatory-refund/propose')
  @UseGuards(AdminAuthGuard, PermissionMatrixGuard)
  @RequiresPermission('DISPUTE_RESOLVE_MANDATORY_REFUND')
  proposeMandatoryRefund(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body('approverId') approverId: string) {
    return this.disputes.proposeMandatoryRefundResolution(orderId, req.actor!, approverId);
  }

  @Post(':orderId/mandatory-refund/approve')
  @UseGuards(AdminAuthGuard, PermissionMatrixGuard)
  @RequiresPermission('DISPUTE_RESOLVE_MANDATORY_REFUND')
  approveMandatoryRefund(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body() dto: ResolveMandatoryRefundDto) {
    return this.disputes.approveMandatoryRefundResolution(orderId, req.actor!, dto);
  }
}
