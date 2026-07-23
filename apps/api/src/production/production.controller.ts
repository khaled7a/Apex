import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ProductionService } from './production.service';
import { UploadProductionUpdateDto } from './dto/upload-production-update.dto';
import { RejectCheckpointDto } from './dto/reject-checkpoint.dto';
import { CustomerAuthGuard } from '../auth/guards/customer-auth.guard';
import { SupplierAuthGuard } from '../auth/guards/supplier-auth.guard';
import { RequestWithActor } from '../auth/request-with-actor';

@ApiTags('production')
@ApiBearerAuth()
@Controller('production')
export class ProductionController {
  constructor(private readonly production: ProductionService) {}

  @Post(':orderId/design')
  @UseGuards(SupplierAuthGuard)
  uploadDesign(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body() dto: UploadProductionUpdateDto) {
    return this.production.uploadDesign(orderId, req.actor!.id!, dto);
  }

  @Post(':orderId/qc')
  @UseGuards(SupplierAuthGuard)
  uploadQc(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body() dto: UploadProductionUpdateDto) {
    return this.production.uploadQc(orderId, req.actor!.id!, dto);
  }

  @Post(':orderId/resubmit')
  @UseGuards(SupplierAuthGuard)
  resubmit(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body() dto: UploadProductionUpdateDto) {
    return this.production.resubmit(orderId, req.actor!.id!, dto);
  }

  @Post(':orderId/approve')
  @UseGuards(CustomerAuthGuard)
  approve(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body('expectedStateVersion') expectedStateVersion: number) {
    return this.production.approve(orderId, req.actor!, expectedStateVersion);
  }

  @Post(':orderId/reject')
  @UseGuards(CustomerAuthGuard)
  reject(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body() dto: RejectCheckpointDto) {
    return this.production.reject(orderId, req.actor!, dto);
  }
}
