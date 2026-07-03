import { IsInt, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UploadCustomsProofDto {
  @ApiProperty()
  @IsString()
  fileUrl!: string;

  @ApiProperty()
  @IsInt()
  expectedStateVersion!: number;
}
