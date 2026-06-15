/* eslint-disable prettier/prettier */
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AdminUserEntity } from './entities/admin-user.entity';
import { AdminShopEntity } from './entities/admin-shop.entity';

import { User } from '../users/user.entity';
import { Shop } from '../shops/shop.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([AdminUserEntity, AdminShopEntity]),
    TypeOrmModule.forFeature([User, Shop]),
  ],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}