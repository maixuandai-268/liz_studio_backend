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

  @Get('stats')
  async getStats() {
    return this.adminService.getDashboardStats();
  }

  @Get('sellers')
  async getSellers(@Query('status') status: string) {
    if (status && status !== 'all') {
      return this.adminService.getSellersByStatus(status);
    }
    return this.adminService.getAllSellers();
  }

  @Get('pending-sellers')
  async getPendingSellers() {
    return this.adminService.getPendingSellers();
  }

  @Post('approve-seller')
  async approve(@Body() dto: ApproveSellerDto) {
    return this.adminService.processSeller(dto);
  }

  @Patch('user-status')
  async handleUser(@Body() dto: UpdateUserStatusDto) {
    return this.adminService.updateUserStatus(dto);
  }

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

  @Get('shops')
  async listShops() {
    return this.adminService.listShops();
  }

  @Get('shops/:id')
  async getShop(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getShopById(id);
  }

  @Patch('shops/:id')
  async updateShop(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateShopDto,
  ) {
    return this.adminService.updateShop(id, dto);
  }

  @Delete('shops/:id')
  async deleteShop(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deleteShop(id);
  }
}
