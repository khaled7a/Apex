import { IsInt, IsNumber, IsPositive, IsString, IsUUID, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResolveMandatoryRefundDto {
  @ApiProperty()
  @IsInt()
  expectedStateVersion!: number;

  @ApiProperty({ description: 'The confirmed trust-fund payment this refund decision concerns.' })
  @IsUUID()
  paymentId!: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  refundedAmountSar!: number;

  @ApiProperty({ description: 'Fraction of the original payment refunded, based on production_progress_ratio at cancellation time.' })
  @IsNumber()
  @IsPositive()
  refundRatio!: number;

  @ApiProperty()
  @IsString()
  reason!: string;
}
