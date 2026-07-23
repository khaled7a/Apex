import { IsEmail, IsIn, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AdminJwtRole } from '../jwt-payload.types';

export class CreateAdminDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ enum: ['OWNER', 'OPERATOR', 'ACCOUNTANT'] })
  @IsIn(['OWNER', 'OPERATOR', 'ACCOUNTANT'])
  role!: AdminJwtRole;
}
