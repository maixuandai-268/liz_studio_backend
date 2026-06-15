/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable prettier/prettier */
/* import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UsersService) { }
  @Get()
  async getAllUsers() {
    return await this.userService.findAll();
  }

  @Get('me')

  @UseGuards(AuthGuard('jwt'))
  async getMe(@Req() req) {
    // FIX: Lấy id từ token và gọi findById để lấy data mới nhất có kèm Shop
    const userId = req.user.id || req.user.sub;
    return await this.userService.findById(userId);
  }
} */

import { Controller, Get, Req, UseGuards, Put, Delete, Param, Body, Query } from '@nestjs/common';

import { AuthGuard } from '@nestjs/passport';

@Controller('employee')
export class UserController {
  constructor(private readonly userService: EmployeeService) {
    console.log("UserController loaded");
  }

  // ✅ GET ALL USERS (with optional role filter)
  @Get()
  async getAllUsers(@Query('role') role?: string) {
    if (role) {
      return await this.userService.findByRole(role);
    }
    return await this.userService.findAll();
  }

  // ✅ UPDATE USER
  @Put(':id')
  async updateUser(
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return await this.userService.update(Number(id), body);
  }

  // ✅ DELETE USER
  @Delete(':id')
  async deleteUser(@Param('id') id: string) {
    const userId = Number(id);
    console.log("🗑️ [UserController] DELETE /api/users/:id received - ID:", userId, "TYPE:", typeof userId);
    try {
      const result = await this.userService.remove(userId);
      console.log("✅ [UserController] DELETE successful - Affected rows:", result.affected);
      return result;
    } catch (err) {
      console.error("❌ [UserController] DELETE failed:", err.message);
      throw err;
    }
  }

  // API cũ giữ nguyên
  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async getMe(@Req() req) {
    const userId = req.user.id || req.user.sub;
    return await this.userService.findById(userId);
  }
}