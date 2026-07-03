import { Module } from '@nestjs/common';
import { CustomsFeesService } from './customs-fees.service';
import { CustomsFeesController } from './customs-fees.controller';

@Module({
  controllers: [CustomsFeesController],
  providers: [CustomsFeesService],
  exports: [CustomsFeesService],
})
export class CustomsFeesModule {}
