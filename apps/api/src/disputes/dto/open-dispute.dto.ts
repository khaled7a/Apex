import { IsIn, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

const OPEN_DISPUTE_EVENTS = [
  'open_payment_dispute',
  'open_quality_dispute',
  'open_delay_dispute',
  'open_shipping_dispute',
  'open_post_signing_dispute_quality',
  'open_post_signing_dispute_shipping',
] as const;

export class OpenDisputeDto {
  @ApiProperty({ enum: OPEN_DISPUTE_EVENTS })
  @IsIn(OPEN_DISPUTE_EVENTS)
  event!: (typeof OPEN_DISPUTE_EVENTS)[number];

  @ApiProperty()
  @IsInt()
  expectedStateVersion!: number;
}
