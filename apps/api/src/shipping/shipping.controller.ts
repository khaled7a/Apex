import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ShippingService } from './shipping.service';
import { AddShippingDocumentDto } from './dto/add-shipping-document.dto';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { RequestWithActor } from '../auth/request-with-actor';

@ApiTags('shipping')
@ApiBearerAuth()
@Controller('shipping')
@UseGuards(AdminAuthGuard)
export class ShippingController {
  constructor(private readonly shipping: ShippingService) {}

  @Post(':orderId/logistics-setup-complete')
  completeLogisticsSetup(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body('expectedStateVersion') expectedStateVersion: number) {
    return this.shipping.completeLogisticsSetup(orderId, req.actor!, expectedStateVersion);
  }

  @Post(':orderId/advance-to-docs')
  advanceToDocs(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body('expectedStateVersion') expectedStateVersion: number) {
    return this.shipping.advanceToDocs(orderId, req.actor!, expectedStateVersion);
  }

  @Post(':orderId/documents')
  addDocument(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body() dto: AddShippingDocumentDto) {
    return this.shipping.addDocument(orderId, req.actor!, dto);
  }

  @Post(':orderId/documents/finalize')
  finalizeDocsUploaded(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body('expectedStateVersion') expectedStateVersion: number) {
    return this.shipping.finalizeDocsUploaded(orderId, req.actor!, expectedStateVersion);
  }

  @Post(':orderId/installments/confirm')
  confirmInstallments(@Param('orderId') orderId: string, @Body('expectedStateVersion') expectedStateVersion: number) {
    return this.shipping.confirmInstallments(orderId, expectedStateVersion);
  }

  @Post(':orderId/arrived')
  markArrived(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body('expectedStateVersion') expectedStateVersion: number) {
    return this.shipping.markArrived(orderId, req.actor!, expectedStateVersion);
  }
}
