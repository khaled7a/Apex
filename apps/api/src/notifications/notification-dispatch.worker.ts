import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import PgBoss from 'pg-boss';
import { Kysely, Transaction } from 'kysely';
import { AppConfig } from '../config/configuration';
import { KYSELY } from '../database/database.module';
import { DB } from '../database/db.types';
import { UnitOfWork } from '../database/unit-of-work';
import { runSystemTransaction } from '../database/run-system-transaction';
import { EmailProvider } from './providers/email.provider';
import { WhatsappProvider } from './providers/whatsapp.provider';

const SEND_NOTIFICATION_QUEUE = 'send-notification';

/**
 * Parallel to PgBossTimerScheduler — its own PgBoss instance over the same
 * Postgres-as-queue infrastructure (no Redis, no second queue technology),
 * dispatching the network send *after* the transition transaction that
 * recorded the notification_log row has already committed. A defensive
 * re-check (row still PENDING?) mirrors the timer worker's own re-check,
 * making a late/duplicate job or an orphaned enqueue (transition rolled back
 * after enqueue but before commit) harmless.
 */
@Injectable()
export class NotificationDispatchWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationDispatchWorker.name);
  private readonly boss: PgBoss;

  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    @Inject(KYSELY) private readonly db: Kysely<DB>,
    private readonly uow: UnitOfWork,
    private readonly emailProvider: EmailProvider,
    private readonly whatsappProvider: WhatsappProvider,
  ) {
    this.boss = new PgBoss(config.get('appDatabaseUrl', { infer: true }));
  }

  async onModuleInit() {
    this.boss.on('error', (err) => this.logger.error(err));
    await this.boss.start();
    await this.boss.createQueue(SEND_NOTIFICATION_QUEUE);
    // pg-boss defaults to batchSize:1 on a 2s poll — fine for the due-timer
    // queue (a couple of timers per order), but notifications fan out to up
    // to 2 recipients x 2 channels on every single real transition, so this
    // queue's volume is an order of magnitude higher. A larger batch keeps
    // up with that without needing a shorter poll interval.
    await this.boss.work(SEND_NOTIFICATION_QUEUE, { batchSize: 25 }, async (jobs) => {
      for (const job of jobs) {
        await this.handleSendNotification(job.data as { notificationLogId: string });
      }
    });
  }

  async onModuleDestroy() {
    await this.boss.stop({ graceful: true, timeout: 5000 }).catch(() => undefined);
  }

  async enqueue(notificationLogId: string): Promise<void> {
    await this.boss.send(SEND_NOTIFICATION_QUEUE, { notificationLogId }, { singletonKey: notificationLogId });
  }

  private async handleSendNotification(data: { notificationLogId: string }): Promise<void> {
    await runSystemTransaction(this.db, this.uow, { role: 'SYSTEM', id: null }, async () => {
      const trx = this.uow.getClient();
      const row = await trx
        .selectFrom('notification_log')
        .selectAll()
        .where('id', '=', data.notificationLogId)
        .where('status', '=', 'PENDING')
        .executeTakeFirst();

      if (!row) {
        this.logger.debug(`send-notification no-op: ${data.notificationLogId} already resolved or rolled back`);
        return;
      }

      const contact = await this.resolveContact(trx, row.recipient_type, row.recipient_id, row.channel);
      if (!contact) {
        await trx.updateTable('notification_log').set({ status: 'SKIPPED_NO_CONTACT' }).where('id', '=', row.id).execute();
        return;
      }

      const result =
        row.channel === 'EMAIL'
          ? await this.emailProvider.send(contact, row.message)
          : await this.whatsappProvider.send(contact, row.message);

      if (result.sent) {
        await trx.updateTable('notification_log').set({ status: 'SENT', sent_at: new Date() }).where('id', '=', row.id).execute();
      } else if (result.reason === 'NO_CONFIG') {
        await trx.updateTable('notification_log').set({ status: 'SKIPPED_NO_CONFIG' }).where('id', '=', row.id).execute();
      } else {
        await trx.updateTable('notification_log').set({ status: 'FAILED', error: result.error ?? null }).where('id', '=', row.id).execute();
      }
    });
  }

  private async resolveContact(
    trx: Transaction<DB>,
    recipientType: string,
    recipientId: string,
    channel: string,
  ): Promise<string | null> {
    if (recipientType === 'CUSTOMER') {
      const customer = await trx.selectFrom('customer').select(['email']).where('id', '=', recipientId).executeTakeFirst();
      return channel === 'EMAIL' ? (customer?.email ?? null) : null;
    }
    const supplier = await trx
      .selectFrom('registered_supplier')
      .select(['contact_email', 'whatsapp_phone'])
      .where('id', '=', recipientId)
      .executeTakeFirst();
    if (!supplier) return null;
    return channel === 'EMAIL' ? supplier.contact_email : supplier.whatsapp_phone;
  }
}
