import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EscalationService } from './escalation.service';
import { CustomerAuthGuard } from '../auth/guards/customer-auth.guard';
import { SupplierAuthGuard } from '../auth/guards/supplier-auth.guard';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { RequestWithActor } from '../auth/request-with-actor';

@ApiTags('escalation')
@ApiBearerAuth()
@Controller('escalation')
export class EscalationController {
  constructor(private readonly escalation: EscalationService) {}

  @Post(':orderId/customer-responds')
  @UseGuards(CustomerAuthGuard)
  customerResponds(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body('expectedStateVersion') expectedStateVersion: number) {
    return this.escalation.customerResponds(orderId, req.actor!.id!, expectedStateVersion);
  }

  @Post(':orderId/supplier-responds')
  @UseGuards(SupplierAuthGuard)
  supplierResponds(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body('expectedStateVersion') expectedStateVersion: number) {
    return this.escalation.supplierResponds(orderId, req.actor!.id!, expectedStateVersion);
  }

  @Post(':orderId/customer-no-response-final')
  @UseGuards(AdminAuthGuard)
  customerNoResponseFinal(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body('expectedStateVersion') expectedStateVersion: number) {
    return this.escalation.customerNoResponseFinal(orderId, req.actor!, expectedStateVersion);
  }

  @Post(':orderId/supplier-no-response-final')
  @UseGuards(AdminAuthGuard)
  supplierNoResponseFinal(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body('expectedStateVersion') expectedStateVersion: number) {
    return this.escalation.supplierNoResponseFinal(orderId, req.actor!, expectedStateVersion);
  }
}
