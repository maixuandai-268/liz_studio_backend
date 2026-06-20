import {
  Controller,
  Get,
  Post,
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

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  private logger = new Logger('ChatController');

  constructor(private chatService: ChatService) {}

  // ── List rooms of current user ──
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

  // ── Group: create ──
  @Post('group')
  async createGroup(@Body() body: { name: string; participantIds: number[] }, @Req() req: any) {
    try {
      const userId = req.user?.id || req.user?.sub;
      if (!userId) throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
      return await this.chatService.createGroupRoom(body.name, Number(userId), body.participantIds);
    } catch (error) {
      this.logger.error(`Failed to create group: ${error}`);
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

  // ── Get channel messages (legacy) ──
  @Get('channel/:projectId')
  async getChannelMessages(@Param('projectId') projectId: string, @Query('limit') limit?: string) {
    try {
      const limitNum = limit ? parseInt(limit, 10) : 50;
      return await this.chatService.getRoomMessages(projectId, limitNum);
    } catch (error) {
      throw new HttpException('Failed to fetch messages', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // ── Send message to a room ──
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

  // ── Get messages of a room ──
  @Get('room/:roomId/messages')
  async getRoomMessagesById(
    @Param('roomId') roomId: string,
    @Query('limit') limit: string,
    @Req() req: any,
  ) {
    try {
      const userId = req.user?.id || req.user?.sub;
      if (!userId) throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);

      const isInRoom = await this.chatService.isUserInRoom(Number(roomId), Number(userId));
      if (!isInRoom) throw new HttpException('Not in room', HttpStatus.FORBIDDEN);

      const limitNum = limit ? parseInt(limit, 10) : 50;
      return await this.chatService.getRoomMessagesById(Number(roomId));
    } catch (error) {
      throw new HttpException(error, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
