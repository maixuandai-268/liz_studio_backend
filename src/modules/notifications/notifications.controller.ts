/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable prettier/prettier */
import {
  Controller,
  Get,
  Patch,
  Param,
  Delete,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
  Post,
  Body,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CursorQueryDto, PaginatedResponseDto } from '@/common/dto/pagination.dto';
import { Notification } from './entities/notification.entity';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  findAll(@Request() req, @Query('page') page?: string, @Query('limit') limit?: string) {
    if (page) {
      return this.notificationsService.findAllByUserPaginated(
        req.user.id,
        Number(page) || 1,
        Number(limit) || 6,
      );
    }
    return this.notificationsService.findAllByUser(req.user.id);
  }

  @Get('v2')
  findAllV2(
    @Request() req,
    @Query() query: CursorQueryDto,
  ): Promise<PaginatedResponseDto<Notification>> {
    return this.notificationsService.findNotificationsWithCursor(req.user.id, query);
  }

  @Get('unread-count')
  getUnreadCount(@Request() req) {
    return this.notificationsService.getUnreadCount(req.user.id).then(count => ({ count }));
  }

  @Patch(':id/read')
  markAsRead(@Param('id', ParseIntPipe) id: number) {
    return this.notificationsService.markAsRead(id);
  }

  @Post('mark-as-read')
  markManyAsRead(@Body('ids') ids: number[]) {
    return this.notificationsService.markManyAsRead(ids);
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
