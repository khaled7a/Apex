import { Module } from '@nestjs/common';
import { ExternalSuppliersService } from './external-suppliers.service';
import { ExternalSuppliersController } from './external-suppliers.controller';

@Module({
  controllers: [ExternalSuppliersController],
  providers: [ExternalSuppliersService],
  exports: [ExternalSuppliersService],
})
export class ExternalSuppliersModule {}
