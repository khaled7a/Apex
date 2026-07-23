import { Global, Module } from '@nestjs/common';
import { FinancialApprovalService } from './financial-approval.service';

@Global()
@Module({
  providers: [FinancialApprovalService],
  exports: [FinancialApprovalService],
})
export class FinancialApprovalModule {}
