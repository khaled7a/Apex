import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RenewalsService } from './renewals.service';
import { CustomerAuthGuard } from '../auth/guards/customer-auth.guard';
import { SupplierAuthGuard } from '../auth/guards/supplier-auth.guard';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { RequestWithActor } from '../auth/request-with-actor';

@ApiTags('renewals')
@ApiBearerAuth()
@Controller('renewals')
export class RenewalsController {
  constructor(private readonly renewals: RenewalsService) {}

  @Post(':orderId/request')
  @UseGuards(CustomerAuthGuard)
  requestRenewal(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body('expectedStateVersion') expectedStateVersion: number) {
    return this.renewals.requestRenewal(orderId, req.actor!.id!, expectedStateVersion);
  }

  @Post(':orderId/supplier-approves')
  @UseGuards(SupplierAuthGuard)
  supplierApproves(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body('expectedStateVersion') expectedStateVersion: number) {
    return this.renewals.supplierApproves(orderId, req.actor!.id!, expectedStateVersion);
  }

  @Post(':orderId/supplier-declines')
  @UseGuards(SupplierAuthGuard)
  supplierDeclines(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body('expectedStateVersion') expectedStateVersion: number) {
    return this.renewals.supplierDeclines(orderId, req.actor!.id!, expectedStateVersion);
  }

  @Post(':orderId/pick-alternate-supplier')
  @UseGuards(AdminAuthGuard)
  pickAlternateSupplier(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body('expectedStateVersion') expectedStateVersion: number) {
    return this.renewals.pickAlternateSupplier(orderId, req.actor!, expectedStateVersion);
  }

  @Post(':orderId/customer-prefers-full-cancel')
  @UseGuards(CustomerAuthGuard)
  customerPrefersFullCancel(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body('expectedStateVersion') expectedStateVersion: number) {
    return this.renewals.customerPrefersFullCancel(orderId, req.actor!.id!, expectedStateVersion);
  }

  @Post(':orderId/admin-approves')
  @UseGuards(AdminAuthGuard)
  adminApproves(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body('expectedStateVersion') expectedStateVersion: number) {
    return this.renewals.adminApproves(orderId, req.actor!, expectedStateVersion);
  }

  @Post(':orderId/admin-rejects')
  @UseGuards(AdminAuthGuard)
  adminRejects(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body('expectedStateVersion') expectedStateVersion: number) {
    return this.renewals.adminRejects(orderId, req.actor!, expectedStateVersion);
  }
}
