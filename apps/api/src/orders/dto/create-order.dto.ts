import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateOrderDto {
  @ApiProperty({ example: 'DOOR_TO_DOOR' })
  @IsString()
  serviceTypeCode!: string;
}
