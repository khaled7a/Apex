import { Injectable, Logger } from '@nestjs/common';
import { Transaction } from 'kysely';
import { DB } from '../database/db.types';
import { buildGenericMessage } from './notification-content';
import { NotificationDispatchWorker } from './notification-dispatch.worker';

export interface RecordAndEnqueueOrder {
  id: string;
  customer_id: string;
  registered_supplier_id: string | null;
}

type ChannelContact = { channel: 'EMAIL' | 'WHATSAPP'; contact: string | null };
type Recipient = { type: 'CUSTOMER' | 'SUPPLIER'; id: string; channels: ChannelContact[] };

/**
 * Records notification intent atomically inside the caller's transaction
 * (TransitionEngineService's transition transaction) — see docs/state-machine.md
 * §0's "state change + audit + notification as one atomic write" principle.
 * The actual network send is a separate best-effort step handled by
 * NotificationDispatchWorker after commit; a failed/slow send never rolls
 * back the underlying business transition.
 *
 * Scope decision (see plan): admins are not notified here — they already
 * monitor via the dashboard/audit log rather than being an external party
 * like the customer/supplier. External suppliers have no contact fields yet
 * (that path is deferred), so only registered suppliers are notified.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly dispatcher: NotificationDispatchWorker) {}

  async recordAndEnqueue(trx: Transaction<DB>, order: RecordAndEnqueueOrder): Promise<void> {
    const message = buildGenericMessage(order.id);
    const recipients: Recipient[] = [];

    const customer = await trx.selectFrom('customer').select(['id', 'email']).where('id', '=', order.customer_id).executeTakeFirst();
    if (customer) {
      recipients.push({ type: 'CUSTOMER', id: customer.id, channels: [{ channel: 'EMAIL', contact: customer.email }] });
    }

    if (order.registered_supplier_id) {
      const supplier = await trx
        .selectFrom('registered_supplier')
        .select(['id', 'contact_email', 'whatsapp_phone'])
        .where('id', '=', order.registered_supplier_id)
        .executeTakeFirst();
      if (supplier) {
        recipients.push({
          type: 'SUPPLIER',
          id: supplier.id,
          channels: [
            { channel: 'EMAIL', contact: supplier.contact_email },
            { channel: 'WHATSAPP', contact: supplier.whatsapp_phone },
          ],
        });
      }
    }

    for (const recipient of recipients) {
      for (const { channel, contact } of recipient.channels) {
        const row = await trx
          .insertInto('notification_log')
          .values({
            order_id: order.id,
            recipient_type: recipient.type,
            recipient_id: recipient.id,
            channel,
            message,
            status: contact ? 'PENDING' : 'SKIPPED_NO_CONTACT',
          })
          .returning('id')
          .executeTakeFirstOrThrow();

        if (contact) {
          // Best-effort, same philosophy as TimerSchedulerPort — the DB row
          // is the source of truth, a failed enqueue here must not roll back
          // the state transition that triggered it.
          await this.dispatcher.enqueue(row.id).catch((err) => this.logger.debug(`enqueue failed for ${row.id}: ${(err as Error).message}`));
        }
      }
    }
  }
}
