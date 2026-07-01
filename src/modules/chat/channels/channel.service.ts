import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Channel } from '../entities/channel.entity';
import { CreateChannelDto } from '../dto/create-channel.dto';
import { UpdateChannelDto } from '../dto/update-channel.dto';

@Injectable()
export class ChannelService {
  private logger = new Logger('ChannelService');

  constructor(
    @InjectRepository(Channel)
    private channelRepository: Repository<Channel>,
  ) {}

  async initializeDefaultChannels() {
    const defaultChannels = [
      {
        name: 'chung',
        description: 'Kênh chung cho tất cả thành viên',
        restrictTo: 'all',
        icon: 'tag',
        isPublic: true,
      },
      {
        name: 'công-việc',
        description: 'Kênh thảo luận công việc dự án',
        restrictTo: 'all',
        icon: 'assignment',
        isPublic: true,
      },
      {
        name: 'thông-báo',
        description: 'Thông báo chỉ admin gửi được',
        restrictTo: 'admin',
        icon: 'campaign',
        isPublic: true,
      },
    ];

    for (const channelData of defaultChannels) {
      const exists = await this.channelRepository.findOne({
        where: { name: channelData.name },
      });

      if (!exists) {
        const channel = this.channelRepository.create(channelData);
        await this.channelRepository.save(channel);
        this.logger.log(`[CHANNEL] Created: ${channelData.name}`);
      }
    }
  }

  async findAll(): Promise<Channel[]> {
    return this.channelRepository.find({
      order: { createdAt: 'ASC' },
    });
  }

  async findById(id: number): Promise<Channel | null> {
    return this.channelRepository.findOne({ where: { id } });
  }

  async findByName(name: string): Promise<Channel | null> {
    return this.channelRepository.findOne({ where: { name } });
  }

  async create(createChannelDto: CreateChannelDto): Promise<Channel> {
    const existing = await this.findByName(createChannelDto.name);
    if (existing) {
      throw new BadRequestException(
        `Channel "${createChannelDto.name}" already exists`,
      );
    }

    const channel = this.channelRepository.create(createChannelDto);
    const saved = await this.channelRepository.save(channel);

    this.logger.log(`[CHANNEL] Created: ${saved.name}`);
    return saved;
  }

  async update(
    id: number,
    updateChannelDto: UpdateChannelDto,
  ): Promise<Channel> {
    const channel = await this.findById(id);
    if (!channel) {
      throw new BadRequestException('Channel not found');
    }

    Object.assign(channel, updateChannelDto);
    const updated = await this.channelRepository.save(channel);

    this.logger.log(`[CHANNEL] Updated: ${updated.name}`);
    return updated;
  }

  async delete(id: number): Promise<void> {
    const channel = await this.findById(id);
    if (!channel) {
      throw new BadRequestException('Channel not found');
    }

    const defaultNames = ['chung', 'công-việc', 'thông-báo'];
    if (defaultNames.includes(channel.name)) {
      throw new BadRequestException('Cannot delete default channels');
    }

    await this.channelRepository.remove(channel);
    this.logger.log(`[CHANNEL] Deleted: ${channel.name}`);
  }

  async incrementMessageCount(channelId: number): Promise<void> {
    await this.channelRepository.increment(
      { id: channelId },
      'messageCount',
      1,
    );
  }
}

