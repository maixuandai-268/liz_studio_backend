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
    const userId = req.user.id || req.user.sub;
    return await this.userService.findById(userId);
  }
} */

import { Controller, Get, Req, UseGuards, Put, Delete, Param, Body, Query, Post, UnauthorizedException } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '@nestjs/passport';
import { User } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';

@Controller('users')
export class UserController {
  constructor(private readonly userService: UsersService) {
  }

  @Post()
  async create(@Body() user : CreateUserDto) {
    return this.userService.create(user);
  }


  @Get()
  async getAllUsers(@Query('role') role?: string) {
    if (role) {
      return await this.userService.findByRole();
    }
    return await this.userService.findAll();
  }

  @Put(':id')
  async updateUser(
    @Param('id') id: string,
    @Body() body: any,
  ) {
    return await this.userService.update(Number(id), body);
  }
  @Delete(':id')
  async deleteUser(@Param('id') id: string) {
    const userId = Number(id);
    try {
      const result = await this.userService.remove(userId);
      return result;
    } catch (err) {
      console.error("❌ [UserController] DELETE failed:");
      throw err;
    }
  }


  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  async getMe(@Req() req) {
    if (!req.user) {
      throw new UnauthorizedException('Not authenticated');
    }
    const userId = req.user.id || req.user.sub;
    return await this.userService.findById(userId);
  }
}

