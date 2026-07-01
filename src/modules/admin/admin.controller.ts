/* eslint-disable prettier/prettier */
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { ApproveSellerDto, UpdateUserStatusDto } from './dto/approve-seller.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateShopDto } from './dto/update-shop.dto';

@Controller('admin')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
export class AdminController {
  constructor(private readonly adminService: AdminService) {}
  @Get('users')
  async listUsers() {
    return this.adminService.listUsers();
  }

  @Get('users/:id')
  async getUser(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getUserById(id);
  }

  @Patch('users/:id')
  async updateUser(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
  ) {
    return this.adminService.updateUser(id, dto);
  }

  @Delete('users/:id')
  async deleteUser(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteUser(id);
  }
}

