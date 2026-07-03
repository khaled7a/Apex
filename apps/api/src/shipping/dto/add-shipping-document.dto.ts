import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AddShippingDocumentDto {
  @ApiProperty({ description: "e.g. 'invoice', 'bill_of_lading', 'certificate'" })
  @IsString()
  docType!: string;

  @ApiProperty()
  @IsString()
  fileUrl!: string;
}
