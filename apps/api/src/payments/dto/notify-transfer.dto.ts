import { IsInt, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class NotifyTransferDto {
  @ApiProperty()
  @IsUUID()
  installmentId!: string;

  @ApiProperty()
  @IsInt()
  expectedStateVersion!: number;
}
