import { Global, Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationDispatchWorker } from './notification-dispatch.worker';
import { EmailProvider } from './providers/email.provider';
import { WhatsappProvider } from './providers/whatsapp.provider';

@Global()
@Module({
  providers: [NotificationsService, NotificationDispatchWorker, EmailProvider, WhatsappProvider],
  exports: [NotificationsService],
})
export class NotificationsModule {}
