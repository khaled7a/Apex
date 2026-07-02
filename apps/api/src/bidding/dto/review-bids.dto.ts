import { IsInt, IsNumber, IsPositive, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReviewBidsDto {
  @ApiProperty()
  @IsInt()
  expectedStateVersion!: number;

  @ApiProperty({ description: 'USD->SAR rate the admin looked up for this approval round.' })
  @IsNumber()
  @IsPositive()
  fxRateUsed!: number;

  @ApiProperty({ description: 'Where the rate came from — required so it can be audited later.' })
  @IsString()
  fxRateSource!: string;
}
