import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UsersService } from './../users/users.service';
/* eslint-disable prettier/prettier */
import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {

  constructor(private authService: AuthService) {}

  @Post('register')
  register(@Body() body: any) {
    return this.authService.register(body);
  }

  @Post('login')
  login(@Body() dto : LoginDto){
    return this.authService.login(dto);
  }

  @Post('refresh')
  async refresh(
  @Body('refresh_token') dto : RefreshTokenDto) {
    return await this.authService.refresh(dto.refresh_token);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout(@Req() req) {
  return this.authService.logout(req.user.id);
}
}

