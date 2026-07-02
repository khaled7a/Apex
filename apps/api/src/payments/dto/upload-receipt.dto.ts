import { IsDateString, IsInt, IsNumber, IsPositive, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UploadReceiptDto {
  @ApiProperty()
  @IsUUID()
  paymentId!: string;

  @ApiProperty()
  @IsInt()
  expectedStateVersion!: number;

  @ApiProperty()
  @IsString()
  fileUrl!: string;

  @ApiProperty({ description: 'Structured bank transfer reference — never just an image, see data-model.md §5.' })
  @IsString()
  bankReferenceNo!: string;

  @ApiProperty()
  @IsString()
  bankName!: string;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  amountClaimed!: number;

  @ApiProperty()
  @IsDateString()
  transferDateClaimed!: string;
}
