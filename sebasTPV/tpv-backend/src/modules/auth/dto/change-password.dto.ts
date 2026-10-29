import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ example: 'ContraseñaTemporal123' })
  @IsString()
  current_password: string;

  @ApiProperty({ example: 'NuevaContraseñaSegura456' })
  @IsString()
  @MinLength(8)
  new_password: string;
}
