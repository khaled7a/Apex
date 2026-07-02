import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ContractsService } from './contracts.service';
import { CreatePaymentPlanDto } from './dto/create-payment-plan.dto';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { CustomerAuthGuard } from '../auth/guards/customer-auth.guard';
import { RequestWithActor } from '../auth/request-with-actor';

@ApiTags('contracts')
@ApiBearerAuth()
@Controller('contracts')
export class ContractsController {
  constructor(private readonly contracts: ContractsService) {}

  @Post(':orderId/payment-plan')
  @UseGuards(AdminAuthGuard)
  createPaymentPlan(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body() dto: CreatePaymentPlanDto) {
    return this.contracts.createPaymentPlan(orderId, req.actor!.id!, dto);
  }

  @Post(':orderId/sign')
  @UseGuards(CustomerAuthGuard)
  sign(
    @Req() req: RequestWithActor,
    @Param('orderId') orderId: string,
    @Body('expectedStateVersion') expectedStateVersion: number,
    @Body('signatureRef') signatureRef: string,
  ) {
    return this.contracts.signContract(orderId, req.actor!, expectedStateVersion, signatureRef);
  }

  @Post(':orderId/logistics-setup-complete')
  @UseGuards(AdminAuthGuard)
  completeLogisticsSetup(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body('expectedStateVersion') expectedStateVersion: number) {
    return this.contracts.completeLogisticsSetup(orderId, req.actor!, expectedStateVersion);
  }
}
