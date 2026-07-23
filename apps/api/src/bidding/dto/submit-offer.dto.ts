import { IsInt, IsNumber, IsOptional, IsPositive, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubmitOfferDto {
  @ApiProperty()
  @IsNumber()
  @IsPositive()
  fobValueUsd!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  leadTimeDays?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  terms?: string;
}
