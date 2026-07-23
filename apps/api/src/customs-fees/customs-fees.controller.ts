import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CustomsFeesService } from './customs-fees.service';
import { CreateCustomsFeeDto } from './dto/create-customs-fee.dto';
import { UploadCustomsProofDto } from './dto/upload-customs-proof.dto';
import { RejectProofDto } from './dto/reject-proof.dto';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { CustomerAuthGuard } from '../auth/guards/customer-auth.guard';
import { PermissionMatrixGuard } from '../auth/guards/permission-matrix.guard';
import { RequiresPermission } from '../auth/decorators/requires-permission.decorator';
import { RequestWithActor } from '../auth/request-with-actor';

@ApiTags('customs-fees')
@ApiBearerAuth()
@Controller('customs-fees')
export class CustomsFeesController {
  constructor(private readonly customsFees: CustomsFeesService) {}

  @Post(':orderId/start')
  @UseGuards(AdminAuthGuard)
  startCustoms(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body('expectedStateVersion') expectedStateVersion: number) {
    return this.customsFees.startCustoms(orderId, req.actor!, expectedStateVersion);
  }

  @Post(':orderId/fees')
  @UseGuards(AdminAuthGuard)
  createDraftFee(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body() dto: CreateCustomsFeeDto) {
    return this.customsFees.createDraftFee(orderId, req.actor!, dto);
  }

  @Post(':orderId/fees/:feeId/approve')
  @UseGuards(AdminAuthGuard, PermissionMatrixGuard)
  @RequiresPermission('CUSTOMS_FEE_MANAGE')
  approveFee(
    @Req() req: RequestWithActor,
    @Param('orderId') orderId: string,
    @Param('feeId') feeId: string,
    @Body('expectedStateVersion') expectedStateVersion: number,
  ) {
    return this.customsFees.approveFee(orderId, feeId, req.actor!, expectedStateVersion);
  }

  @Post(':orderId/pay-and-upload-proof')
  @UseGuards(CustomerAuthGuard)
  customerPaysUploadsProof(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body() dto: UploadCustomsProofDto) {
    return this.customsFees.customerPaysUploadsProof(orderId, req.actor!.id!, dto);
  }

  @Post(':orderId/verify')
  @UseGuards(AdminAuthGuard)
  adminVerifiesFee(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body('expectedStateVersion') expectedStateVersion: number) {
    return this.customsFees.adminVerifiesFee(orderId, req.actor!, expectedStateVersion);
  }

  @Post(':orderId/reject-proof')
  @UseGuards(AdminAuthGuard)
  rejectProof(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body() dto: RejectProofDto) {
    return this.customsFees.rejectProof(orderId, req.actor!, dto);
  }

  @Post(':orderId/add-more-fees')
  @UseGuards(AdminAuthGuard)
  addMoreFees(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body('expectedStateVersion') expectedStateVersion: number) {
    return this.customsFees.addMoreFees(orderId, req.actor!, expectedStateVersion);
  }

  @Post(':orderId/no-more-fees')
  @UseGuards(AdminAuthGuard)
  noMoreFees(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body('expectedStateVersion') expectedStateVersion: number) {
    return this.customsFees.noMoreFees(orderId, req.actor!, expectedStateVersion);
  }
}
