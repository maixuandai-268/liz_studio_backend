/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';
import { ShopModule } from '../shops/shops.module';

@Module({
  imports: [
    UsersModule,
    ShopModule,
    PassportModule,
    JwtModule.register(
        {
            secret : 'OutfitsLab_Key', 
            signOptions : {expiresIn : '1d'}
        }
    )
],
  controllers: [AuthController],
  providers: [AuthService,JwtStrategy],
  exports : [JwtModule]
})
export class AuthModule {}