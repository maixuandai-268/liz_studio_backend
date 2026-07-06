import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ChannelService } from './channel.service';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { CreateChannelDto } from '../dto/create-channel.dto';
import { UpdateChannelDto } from '../dto/update-channel.dto';
import { CursorQueryDto, PaginatedResponseDto } from '@/common/dto/pagination.dto';
import { MessageDto } from '../dto/message.dto';

@Controller('channels')
export class ChannelController {
  private logger = new Logger('ChannelController');

  constructor(private channelService: ChannelService) {}

  /**
   * GET /api/channels
   * Lấy tất cả channels (everyone)
   */
  @Get()
  async getAllChannels() {
    try {
      return await this.channelService.findAll();
    } catch (error) {
      this.logger.error(`Failed to fetch channels: ${error}`);
      throw new HttpException(
        'Failed to fetch channels',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * GET /api/channels/:id
   * Lấy 1 channel by ID
   */
  @Get(':id')
  async getChannel(@Param('id') id: string) {
    try {
      const channel = await this.channelService.findById(parseInt(id, 10));
      if (!channel) {
        throw new HttpException('Channel not found', HttpStatus.NOT_FOUND);
      }
      return channel;
    } catch (error) {
      this.logger.error(`Failed to fetch channel: ${error}`);
      throw new HttpException(error, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * POST /api/channels
   * Tạo channel mới (admin only)
   */
  @Post()
  @UseGuards(RolesGuard)
  @Roles('admin')
  async createChannel(@Body() createChannelDto: CreateChannelDto) {
    try {
      return await this.channelService.create(createChannelDto);
    } catch (error) {
      this.logger.error(`Failed to create channel: ${error}`);
      throw new HttpException(error, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * PATCH /api/channels/:id
   * Update channel (admin only)
   */
  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async updateChannel(
    @Param('id') id: string,
    @Body() updateChannelDto: UpdateChannelDto,
  ) {
    try {
      return await this.channelService.update(
        parseInt(id, 10),
        updateChannelDto,
      );
    } catch (error) {
      this.logger.error(`Failed to update channel: ${error}`);
      throw new HttpException(error, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * DELETE /api/channels/:id
   * Delete channel (admin only)
   */
  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('admin')
  async deleteChannel(@Param('id') id: string) {
    try {
      await this.channelService.delete(parseInt(id, 10));
      return { success: true, message: 'Channel deleted' };
    } catch (error) {
      this.logger.error(`Failed to delete channel: ${error}`);
      throw new HttpException(error, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * GET /api/channels/:channelName/messages/v2
   * Lấy messages của channel với cursor pagination
   */
  @Get(':channelName/messages/v2')
  @UseGuards(JwtAuthGuard)
  async getChannelMessagesV2(
    @Param('channelName') channelName: string,
    @Query() query: CursorQueryDto,
  ): Promise<PaginatedResponseDto<MessageDto>> {
    try {
      return await this.channelService.findChannelMessagesWithCursor(channelName, query);
    } catch (error) {
      this.logger.error(`Failed to fetch channel messages v2: ${error}`);
      throw new HttpException(error || 'Failed to fetch messages', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}

