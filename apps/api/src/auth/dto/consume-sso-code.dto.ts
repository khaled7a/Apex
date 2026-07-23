import { IsIn, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ConsumeSsoCodeDto {
  @ApiProperty({ enum: ['CUSTOMER', 'SUPPLIER', 'ADMIN'] })
  @IsIn(['CUSTOMER', 'SUPPLIER', 'ADMIN'])
  actorType!: 'CUSTOMER' | 'SUPPLIER' | 'ADMIN';

  @ApiProperty()
  @IsString()
  code!: string;
}
