import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CursorQueryDto, PaginatedResponseDto } from '@/common/dto/pagination.dto';
import { MessageDto } from './dto/message.dto';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  private logger = new Logger('ChatController');

  constructor(private chatService: ChatService) {}

  @Get('rooms')
  async getUserRooms(@Req() req: any) {
    try {
      const userId = req.user?.id || req.user?.sub;
      if (!userId) throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
      return await this.chatService.getUserRooms(Number(userId));
    } catch (error) {
      this.logger.error(`Failed to fetch rooms: ${error}`);
      throw new HttpException(error, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('room/by-project/:projectId')
  async getRoomByProject(@Param('projectId') projectId: string) {
    try {
      return await this.chatService.getRoomByProject(Number(projectId));
    } catch (error) {
      throw new HttpException('Room not found', HttpStatus.NOT_FOUND);
    }
  }

  @Post('dm')
  async createOrGetDM(@Body() body: { targetUserId: number }, @Req() req: any) {
    try {
      const userId = req.user?.id || req.user?.sub;
      if (!userId) throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
      return await this.chatService.findOrCreateDM(Number(userId), body.targetUserId);
    } catch (error) {
      this.logger.error(`Failed to create DM: ${error}`);
      throw new HttpException(error, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('group')
  async createGroup(@Body() body: { name: string; projectId?: number; participantIds: number[] }, @Req() req: any) {
    try {
      const userId = req.user?.id || req.user?.sub;
      if (!userId) throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
      return await this.chatService.createGroupRoom(body.name, Number(userId), body.participantIds, body.projectId);
    } catch (error) {
      this.logger.error(`Failed to create group: ${error}`);
      throw new HttpException(error, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('room/:roomId/participants')
  async addParticipant(@Param('roomId') roomId: string, @Body() body: { userId: number }, @Req() req: any) {
    try {
      const userId = req.user?.id || req.user?.sub;
      if (!userId) throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
      return await this.chatService.addParticipant(Number(roomId), body.userId);
    } catch (error) {
      this.logger.error(`Failed to add participant: ${error}`);
      throw new HttpException(error, HttpStatus.BAD_REQUEST);
    }
  }

  @Delete('room/:roomId/participants/:targetUserId')
  async removeParticipant(@Param('roomId') roomId: string, @Param('targetUserId') targetUserId: string, @Req() req: any) {
    try {
      const userId = req.user?.id || req.user?.sub;
      if (!userId) throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
      return await this.chatService.removeParticipant(Number(roomId), Number(targetUserId));
    } catch (error) {
      this.logger.error(`Failed to remove participant: ${error}`);
      throw new HttpException(error, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('channel')
  async sendChannelMessage(@Body() body: any, @Req() req: any) {
    try {
      const userId = req.user?.id || req.user?.sub;
      const userName = req.user?.code || req.user?.name || 'Unknown';
      if (!userId) throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
      return await this.chatService.sendMessage(body.projectId, String(userId), userName, body.content);
    } catch (error) {
      throw new HttpException(error || 'Failed to send message', HttpStatus.BAD_REQUEST);
    }
  }

  @Get('room/:roomId/messages/v2')
  async getRoomMessagesV2(
    @Param('roomId') roomId: string,
    @Query() query: CursorQueryDto,
  ): Promise<PaginatedResponseDto<MessageDto>> {
    try {
      return await this.chatService.findRoomMessagesWithCursor(Number(roomId), query);
    } catch (error) {
      this.logger.error(`Failed to fetch messages v2: ${error}`);
      throw new HttpException(error || 'Failed to fetch messages', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('channel/:projectId')
  async getChannelMessages(@Param('projectId') projectId: string, @Query('limit') limit?: string) {
    try {
      const limitNum = limit ? parseInt(limit, 10) : 50;
      return await this.chatService.getRoomMessages(projectId, limitNum);
    } catch (error) {
      throw new HttpException('Failed to fetch messages', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('room/:roomId/message')
  async sendRoomMessage(
    @Param('roomId') roomId: string,
    @Body() body: { content: string },
    @Req() req: any,
  ) {
    try {
      const userId = req.user?.id || req.user?.sub;
      const userName = req.user?.code || req.user?.name || 'Unknown';
      if (!userId) throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);

      const isInRoom = await this.chatService.isUserInRoom(Number(roomId), Number(userId));
      if (!isInRoom) throw new HttpException('Not in room', HttpStatus.FORBIDDEN);

      return await this.chatService.sendRoomMessage(Number(roomId), Number(userId), userName, body.content);
    } catch (error) {
      throw new HttpException(error, HttpStatus.BAD_REQUEST);
    }
  }

  @Post('messages/:id/read')
  async markAsRead(@Param('id') messageId: string, @Req() req: any) {
    try {
      const userId = req.user?.id || req.user?.sub;
      if (!userId) throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
      return await this.chatService.markMessageAsRead(Number(messageId), Number(userId));
    } catch (error) {
      throw new HttpException(error, HttpStatus.BAD_REQUEST);
    }
  }
}

