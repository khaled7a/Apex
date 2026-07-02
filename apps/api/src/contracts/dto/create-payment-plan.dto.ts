import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsNumber, IsOptional, IsPositive, IsString, ValidateNested } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { OrderState, RefundPolicy } from '../../database/db.types';

export class PaymentInstallmentInputDto {
  @ApiProperty()
  @IsString()
  label!: string;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  expectedAmountSar!: number;

  @ApiProperty()
  @IsBoolean()
  isTrustFund!: boolean;

  @ApiProperty({ enum: ['NEVER_REFUNDABLE', 'REFUNDABLE_UNTIL_EVENT', 'REFUNDABLE_BY_DISPUTE_ONLY'] })
  @IsIn(['NEVER_REFUNDABLE', 'REFUNDABLE_UNTIL_EVENT', 'REFUNDABLE_BY_DISPUTE_ONLY'])
  refundPolicy!: RefundPolicy;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  dueStage?: OrderState;
}

export class CreatePaymentPlanDto {
  @ApiProperty({ type: [PaymentInstallmentInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PaymentInstallmentInputDto)
  installments!: PaymentInstallmentInputDto[];
}
