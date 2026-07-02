import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { NotifyTransferDto } from './dto/notify-transfer.dto';
import { UploadReceiptDto } from './dto/upload-receipt.dto';
import { CustomerAuthGuard } from '../auth/guards/customer-auth.guard';
import { SupplierAuthGuard } from '../auth/guards/supplier-auth.guard';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { RequestWithActor } from '../auth/request-with-actor';

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post(':orderId/notify-transfer')
  @UseGuards(CustomerAuthGuard)
  notifyTransfer(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body() dto: NotifyTransferDto) {
    return this.payments.notifyTransfer(orderId, req.actor!, dto);
  }

  @Post(':orderId/receipts')
  @UseGuards(CustomerAuthGuard)
  uploadReceipt(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body() dto: UploadReceiptDto) {
    return this.payments.uploadReceipt(orderId, req.actor!, dto);
  }

  @Post(':orderId/verification/start')
  @UseGuards(AdminAuthGuard)
  startVerification(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body('expectedStateVersion') expectedStateVersion: number) {
    return this.payments.startVerification(orderId, req.actor!, expectedStateVersion);
  }

  @Post(':orderId/verification/match')
  @UseGuards(AdminAuthGuard)
  markVerified(
    @Req() req: RequestWithActor,
    @Param('orderId') orderId: string,
    @Body('paymentId') paymentId: string,
    @Body('expectedStateVersion') expectedStateVersion: number,
  ) {
    return this.payments.markReceiptVerified(orderId, req.actor!, paymentId, expectedStateVersion);
  }

  @Post(':orderId/verification/reject')
  @UseGuards(AdminAuthGuard)
  rejectReceipt(
    @Req() req: RequestWithActor,
    @Param('orderId') orderId: string,
    @Body('paymentId') paymentId: string,
    @Body('reason') reason: string,
    @Body('expectedStateVersion') expectedStateVersion: number,
  ) {
    return this.payments.rejectReceipt(orderId, req.actor!, paymentId, reason, expectedStateVersion);
  }

  @Post(':orderId/verification/escalate')
  @UseGuards(AdminAuthGuard)
  escalate(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body('expectedStateVersion') expectedStateVersion: number) {
    return this.payments.escalateReceiptToDispute(orderId, req.actor!, expectedStateVersion);
  }

  @Post(':orderId/supplier-ack')
  @UseGuards(SupplierAuthGuard)
  supplierAcknowledges(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body('expectedStateVersion') expectedStateVersion: number) {
    return this.payments.supplierAcknowledges(orderId, req.actor!.id!, expectedStateVersion);
  }

  @Post(':orderId/admin-verification/propose')
  @UseGuards(AdminAuthGuard)
  proposeAdminVerification(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body('approverId') approverId: string) {
    return this.payments.proposeAdminVerification(orderId, req.actor!.id!, approverId);
  }

  @Post(':orderId/admin-verification/approve')
  @UseGuards(AdminAuthGuard)
  approveAdminVerification(
    @Req() req: RequestWithActor,
    @Param('orderId') orderId: string,
    @Body('paymentId') paymentId: string,
    @Body('expectedStateVersion') expectedStateVersion: number,
  ) {
    return this.payments.approveAdminVerification(orderId, req.actor!, paymentId, expectedStateVersion);
  }

  @Post(':orderId/verification-failed')
  @UseGuards(AdminAuthGuard)
  verificationFailed(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body('expectedStateVersion') expectedStateVersion: number) {
    return this.payments.verificationFailed(orderId, req.actor!, expectedStateVersion);
  }
}
