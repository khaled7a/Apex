import { Global, Module } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { NotificationDispatchWorker } from './notification-dispatch.worker';
import { EmailProvider } from './providers/email.provider';
import { WhatsappProvider } from './providers/whatsapp.provider';

@Global()
@Module({
  providers: [NotificationsService, NotificationDispatchWorker, EmailProvider, WhatsappProvider],
  // EmailProvider is also exported directly — AuthService's forgot-password
  // flow sends an ad hoc reset-link email that isn't tied to any order
  // transition, so it bypasses NotificationsService (which is hard-wired to
  // order-transition events) and calls the transport-layer provider itself.
  exports: [NotificationsService, EmailProvider],
})
export class NotificationsModule {}
