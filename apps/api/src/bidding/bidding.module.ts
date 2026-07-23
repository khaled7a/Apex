import { Module } from '@nestjs/common';
import { BiddingService } from './bidding.service';
import { BiddingController } from './bidding.controller';

@Module({
  controllers: [BiddingController],
  providers: [BiddingService],
  exports: [BiddingService],
})
export class BiddingModule {}
