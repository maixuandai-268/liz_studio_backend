/* eslint-disable prettier/prettier */
import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from './entities/notification.entity';
import { NotificationsService } from './notifications.service';
import { NotificationsController } from './notifications.controller';
import { NotificationTriggersService } from './notification-triggers.service';
import { MailService } from './mail.service';
import { RealtimeModule } from '@/modules/realtime/realtime.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification]),
    forwardRef(() => RealtimeModule),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationTriggersService, MailService],
  exports: [NotificationsService, NotificationTriggersService, MailService],
})
export class NotificationsModule {}
