import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@supermercadocentral.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'ContraseñaTemporal123' })
  @IsString()
  @IsNotEmpty()
  password: string;
}
