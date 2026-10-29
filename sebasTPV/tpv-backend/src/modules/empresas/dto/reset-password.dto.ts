import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({ example: 'ContraseñaTemporal123' })
  @IsString()
  @MinLength(8)
  password: string;
}
