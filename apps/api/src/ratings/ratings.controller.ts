import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { RatingsService } from './ratings.service';
import { RateSupplierDto } from './dto/rate-supplier.dto';
import { CustomerAuthGuard } from '../auth/guards/customer-auth.guard';
import { RequestWithActor } from '../auth/request-with-actor';

@ApiTags('ratings')
@ApiBearerAuth()
@Controller()
export class RatingsController {
  constructor(private readonly ratings: RatingsService) {}

  @Post('delivery/:orderId/sign')
  @UseGuards(CustomerAuthGuard)
  customerSigns(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body('expectedStateVersion') expectedStateVersion: number) {
    return this.ratings.customerSigns(orderId, req.actor!.id!, expectedStateVersion);
  }

  @Post('ratings/:orderId')
  @UseGuards(CustomerAuthGuard)
  rateSupplier(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body() dto: RateSupplierDto) {
    return this.ratings.rateSupplier(orderId, req.actor!.id!, dto);
  }
}
