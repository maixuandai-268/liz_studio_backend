/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';
import { NotificationsModule } from '@/modules/notifications/notifications.module';
require('dotenv').config();

@Module({
  imports: [
    UsersModule,
    PassportModule,
    NotificationsModule,
    JwtModule.register(
        {
            secret : process.env.JWT_SECRET,
            signOptions : {expiresIn : '1d'}
        }
    )
],
  controllers: [AuthController],
  providers: [AuthService,JwtStrategy],
  exports : [JwtModule]
})
export class AuthModule {}

