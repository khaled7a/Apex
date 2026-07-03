import { IsInt, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RejectProofDto {
  @ApiProperty()
  @IsString()
  reason!: string;

  @ApiProperty()
  @IsInt()
  expectedStateVersion!: number;
}
