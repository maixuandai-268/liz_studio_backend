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
  ValidationPipe,
} from '@nestjs/common';
import { ChatService } from './chat.service';
import { ChannelService } from './channels/channel.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { CursorQueryDto, PaginatedResponseDto } from '@/common/dto/pagination.dto';
import { MessageDto } from './dto/message.dto';
import { CreateDmDto } from './dto/create-dm.dto';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  private logger = new Logger('ChatController');

  constructor(
    private chatService: ChatService,
    private channelService: ChannelService,
  ) {}

  @Get('rooms')
  async getUserRooms(@Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    if (!userId) throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    return await this.chatService.getUserRooms(Number(userId));
  }

  @Get('room/by-project/:projectId')
  async getRoomByProject(@Param('projectId') projectId: string) {
    return await this.chatService.getRoomByProject(Number(projectId));
  }

  @Post('dm')
  async createOrGetDM(
    @Body(ValidationPipe) body: CreateDmDto,
    @Req() req: any,
  ) {
    const userId = req.user?.id || req.user?.sub;
    if (!userId) throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    return await this.chatService.findOrCreateDM(Number(userId), body.targetUserId);
  }

  @Post('group')
  async createGroup(
    @Body() body: { name: string; projectId?: number; participantIds: number[] },
    @Req() req: any,
  ) {
    const userId = req.user?.id || req.user?.sub;
    if (!userId) throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    return await this.chatService.createGroupRoom(
      body.name, Number(userId), body.participantIds, body.projectId,
    );
  }

  @Post('room/:roomId/participants')
  async addParticipant(
    @Param('roomId') roomId: string,
    @Body() body: { userId: number },
    @Req() req: any,
  ) {
    const userId = req.user?.id || req.user?.sub;
    if (!userId) throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    return await this.chatService.addParticipant(Number(roomId), body.userId);
  }

  @Delete('room/:roomId/participants/:targetUserId')
  async removeParticipant(
    @Param('roomId') roomId: string,
    @Param('targetUserId') targetUserId: string,
    @Req() req: any,
  ) {
    const userId = req.user?.id || req.user?.sub;
    if (!userId) throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    return await this.chatService.removeParticipant(Number(roomId), Number(targetUserId));
  }

  @Post('channel')
  async sendChannelMessage(@Body() body: any, @Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    const userName = req.user?.code || req.user?.name || 'Unknown';
    if (!userId) throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    return await this.chatService.sendMessage(
      body.projectId, String(userId), userName, body.content,
    );
  }

  @Get('room/:roomId/messages/v2')
  async getRoomMessagesV2(
    @Param('roomId') roomId: string,
    @Query() query: CursorQueryDto,
  ): Promise<PaginatedResponseDto<MessageDto>> {
    return await this.chatService.findRoomMessagesWithCursor(Number(roomId), query);
  }

  @Get('channels/:channelName/messages/v2')
  async getChannelMessagesV2(
    @Param('channelName') channelName: string,
    @Query() query: CursorQueryDto,
  ) {
    return await this.channelService.findChannelMessagesWithCursor(channelName, query);
  }

  @Get('channel/:projectId')
  async getChannelMessages(
    @Param('projectId') projectId: string,
    @Query('limit') limit?: string,
  ) {
    const limitNum = limit ? parseInt(limit, 10) : 50;
    return await this.chatService.getRoomMessages(projectId, limitNum);
  }

  @Post('room/:roomId/message')
  async sendRoomMessage(
    @Param('roomId') roomId: string,
    @Body() body: { content: string },
    @Req() req: any,
  ) {
    const userId = req.user?.id || req.user?.sub;
    const userName = req.user?.code || req.user?.name || 'Unknown';
    if (!userId) throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);

    const isInRoom = await this.chatService.isUserInRoom(Number(roomId), Number(userId));
    if (!isInRoom) throw new HttpException('Not in room', HttpStatus.FORBIDDEN);

    return await this.chatService.sendRoomMessage(
      Number(roomId), Number(userId), userName, body.content,
    );
  }

  @Post('messages/:id/read')
  async markAsRead(@Param('id') messageId: string, @Req() req: any) {
    const userId = req.user?.id || req.user?.sub;
    if (!userId) throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    return await this.chatService.markMessageAsRead(Number(messageId), Number(userId));
  }
}
