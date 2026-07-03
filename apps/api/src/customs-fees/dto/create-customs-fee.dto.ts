import { IsNumber, IsPositive, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCustomsFeeDto {
  @ApiProperty()
  @IsString()
  label!: string;

  @ApiProperty()
  @IsNumber()
  @IsPositive()
  amountSar!: number;
}
