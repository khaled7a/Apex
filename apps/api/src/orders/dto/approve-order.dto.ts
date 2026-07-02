import { IsIn, IsInt, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApproveOrderDto {
  @ApiProperty()
  @IsInt()
  expectedStateVersion!: number;

  @ApiPropertyOptional({ enum: ['REGISTERED', 'EXTERNAL'] })
  @IsOptional()
  @IsIn(['REGISTERED', 'EXTERNAL'])
  supplierType?: 'REGISTERED' | 'EXTERNAL';

  @ApiPropertyOptional({ description: 'Required when supplierType=EXTERNAL — the external_supplier row the customer brought.' })
  @IsOptional()
  @IsUUID()
  externalSupplierId?: string;
}
