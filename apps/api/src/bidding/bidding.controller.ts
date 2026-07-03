import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BiddingService } from './bidding.service';
import { SubmitOfferDto } from './dto/submit-offer.dto';
import { ReviewBidsDto } from './dto/review-bids.dto';
import { SupplierAuthGuard } from '../auth/guards/supplier-auth.guard';
import { CustomerAuthGuard } from '../auth/guards/customer-auth.guard';
import { AdminAuthGuard } from '../auth/guards/admin-auth.guard';
import { PermissionMatrixGuard } from '../auth/guards/permission-matrix.guard';
import { RequiresPermission } from '../auth/decorators/requires-permission.decorator';
import { RequestWithActor } from '../auth/request-with-actor';

@ApiTags('bidding')
@ApiBearerAuth()
@Controller('bidding')
export class BiddingController {
  constructor(private readonly bidding: BiddingService) {}

  @Get('board')
  @UseGuards(SupplierAuthGuard)
  listBiddingBoard() {
    return this.bidding.listBiddingBoard();
  }

  @Post(':orderId/offers')
  @UseGuards(SupplierAuthGuard)
  submitOffer(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body() dto: SubmitOfferDto) {
    return this.bidding.submitOffer(orderId, req.actor!.id!, dto);
  }

  @Get(':orderId/offers')
  @UseGuards(SupplierAuthGuard)
  listMyOffers(@Param('orderId') orderId: string) {
    return this.bidding.listMyOffers(orderId);
  }

  @Get(':orderId/offers/customer-view')
  @UseGuards(CustomerAuthGuard)
  listOffersForCustomer(@Param('orderId') orderId: string) {
    return this.bidding.listOffersForCustomer(orderId);
  }

  @Post(':orderId/review')
  @UseGuards(AdminAuthGuard, PermissionMatrixGuard)
  @RequiresPermission('OFFER_APPROVAL_AND_FX_RATE_ENTRY')
  reviewBids(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body() dto: ReviewBidsDto) {
    return this.bidding.reviewBids(orderId, req.actor!, dto);
  }

  @Post(':orderId/fx-deviation/approve')
  @UseGuards(AdminAuthGuard, PermissionMatrixGuard)
  @RequiresPermission('FX_RATE_DEVIATION_OWNER_APPROVAL')
  approveFxDeviation(@Req() req: RequestWithActor, @Param('orderId') orderId: string) {
    return this.bidding.approveFxDeviation(orderId, req.actor!);
  }

  @Post(':orderId/select/:offerId')
  @UseGuards(CustomerAuthGuard)
  selectOffer(
    @Req() req: RequestWithActor,
    @Param('orderId') orderId: string,
    @Param('offerId') offerId: string,
    @Body('expectedStateVersion') expectedStateVersion: number,
  ) {
    return this.bidding.selectOffer(orderId, req.actor!, offerId, expectedStateVersion);
  }

  @Post(':orderId/reject-all')
  @UseGuards(CustomerAuthGuard)
  rejectAll(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body('expectedStateVersion') expectedStateVersion: number) {
    return this.bidding.rejectAllOffers(orderId, req.actor!, expectedStateVersion);
  }

  @Post(':orderId/republish')
  @UseGuards(AdminAuthGuard, PermissionMatrixGuard)
  @RequiresPermission('ORDER_APPROVE_EDIT_REJECT')
  republish(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body('expectedStateVersion') expectedStateVersion: number) {
    return this.bidding.republish(orderId, req.actor!, expectedStateVersion);
  }

  @Post(':orderId/extend-deadline')
  @UseGuards(AdminAuthGuard, PermissionMatrixGuard)
  @RequiresPermission('ORDER_APPROVE_EDIT_REJECT')
  extendDeadline(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body('expectedStateVersion') expectedStateVersion: number) {
    return this.bidding.extendDeadline(orderId, req.actor!, expectedStateVersion);
  }

  @Post(':orderId/cancel')
  @UseGuards(AdminAuthGuard)
  cancel(@Req() req: RequestWithActor, @Param('orderId') orderId: string, @Body('expectedStateVersion') expectedStateVersion: number) {
    return this.bidding.cancel(orderId, req.actor!, expectedStateVersion);
  }
}
