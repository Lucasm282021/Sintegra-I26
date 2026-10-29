import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UsuarioAutenticado } from '../../common/auth/authenticated-user.interface';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Inicia sesión y devuelve un token Bearer' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Get('me')
  @ApiOperation({ summary: 'Devuelve el usuario, la empresa y los módulos habilitados' })
  me(@CurrentUser() user: UsuarioAutenticado) {
    return this.authService.me(user);
  }

  @Post('change-password')
  @ApiOperation({ summary: 'Cambia la contraseña propia e invalida las sesiones anteriores' })
  changePassword(@CurrentUser() user: UsuarioAutenticado, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.id, dto);
  }
}
