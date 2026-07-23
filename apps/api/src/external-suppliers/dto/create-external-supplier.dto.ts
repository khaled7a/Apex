import { IsInt, IsOptional, IsString, Min } from 'class-validator';
import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';

export class CreateExternalSupplierDto {
  @ApiProperty()
  @IsString()
  legalName!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  licenseNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  yearsActive?: number;

  @ApiPropertyOptional({ description: "e.g. 'aiqicha' / 'qcc' / 'manual'" })
  @IsOptional()
  @IsString()
  verificationSource?: string;
}
