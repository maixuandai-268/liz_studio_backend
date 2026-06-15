/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable prettier/prettier */
import {
    Controller,
    Get,
    Patch,
    Param,
    Delete,
    UseGuards,
    Request,
    ParseIntPipe,
  } from '@nestjs/common';
  import { NotificationsService } from './notifications.service';
  import { JwtAuthGuard } from '../auth/jwt-auth.guard';
  
  @Controller('notifications')
  @UseGuards(JwtAuthGuard)
  export class NotificationsController {
    constructor(private readonly notificationsService: NotificationsService) {}
  
    @Get()
    findAll(@Request() req) {
      return this.notificationsService.findAllByUser(req.user.id);
    }
  
    @Patch(':id/read')
    markAsRead(@Param('id', ParseIntPipe) id: number) {
      return this.notificationsService.markAsRead(id);
    }
  
    @Patch('read-all')
    markAllAsRead(@Request() req) {
      return this.notificationsService.markAllAsRead(req.user.id);
    }
  
    @Delete(':id')
    delete(@Param('id', ParseIntPipe) id: number) {
      return this.notificationsService.delete(id);
    }
  }
