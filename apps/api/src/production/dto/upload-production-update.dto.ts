import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const PRODUCTION_UPDATE_KINDS = ['text', 'image', 'invoice', 'question'] as const;

export class UploadProductionUpdateDto {
  @ApiProperty({ enum: PRODUCTION_UPDATE_KINDS })
  @IsIn(PRODUCTION_UPDATE_KINDS)
  kind!: (typeof PRODUCTION_UPDATE_KINDS)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  content?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  fileUrl?: string;

  @ApiProperty()
  @IsInt()
  expectedStateVersion!: number;
}
