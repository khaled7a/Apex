import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import PgBoss from 'pg-boss';
import { Kysely } from 'kysely';
import { AppConfig } from '../config/configuration';
import { KYSELY } from '../database/database.module';
import { DB } from '../database/db.types';
import { UnitOfWork } from '../database/unit-of-work';
import { runSystemTransaction } from '../database/run-system-transaction';
import { TransitionEngineService } from '../transition-engine/transition-engine.service';
import { TimerSchedulerPort } from './timer-scheduler.port';

const DUE_TIMER_QUEUE = 'due-timer';

const EVENT_BY_TIMER_TYPE: Record<string, string> = {
  BIDDING_DEADLINE: 'deadline_reached',
  CUSTOMER_SLA: 'customer_sla_expired',
  SUPPLIER_SLA: 'supplier_sla_expired',
  ESCALATION_TIMEOUT: 'no_response_timeout',
};

/**
 * Uses PostgreSQL itself as the job queue (pg-boss) rather than adding Redis
 * — see the implementation plan in the review doc for why this was chosen
 * over BullMQ/@nestjs/schedule. The `scheduled_timer` table remains the
 * source of truth: this only decides *when* to check it, never bypasses it.
 */
@Injectable()
export class PgBossTimerScheduler implements TimerSchedulerPort, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PgBossTimerScheduler.name);
  private readonly boss: PgBoss;

  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    @Inject(KYSELY) private readonly db: Kysely<DB>,
    private readonly uow: UnitOfWork,
    // Resolved lazily in handleDueTimer(), NOT injected in this constructor:
    // TransitionEngineService optionally depends on TIMER_SCHEDULER (this
    // class), so a direct constructor dependency the other way round is a
    // genuine circular provider graph. Nest didn't raise a clean
    // "circular dependency" error for it in practice — app bootstrap just
    // hung indefinitely after DI container construction — so this is worked
    // around structurally instead of chasing forwardRef() placement.
    private readonly moduleRef: ModuleRef,
  ) {
    this.boss = new PgBoss(config.get('appDatabaseUrl', { infer: true }));
  }

  private get engine(): TransitionEngineService {
    return this.moduleRef.get(TransitionEngineService, { strict: false });
  }

  async onModuleInit() {
    this.boss.on('error', (err) => this.logger.error(err));
    await this.boss.start();
    await this.boss.createQueue(DUE_TIMER_QUEUE);
    await this.boss.work(DUE_TIMER_QUEUE, async (jobs) => {
      for (const job of jobs) {
        await this.handleDueTimer(job.data as { orderId: string; timerType: string });
      }
    });
  }

  async onModuleDestroy() {
    await this.boss.stop({ graceful: true, timeout: 5000 }).catch(() => undefined);
  }

  async enqueue(orderId: string, timerType: string, runAt: Date): Promise<void> {
    const startAfter = runAt.getTime() <= Date.now() ? new Date() : runAt;
    await this.boss.send(DUE_TIMER_QUEUE, { orderId, timerType }, { startAfter, singletonKey: `${orderId}:${timerType}` });
  }

  async cancel(_orderId: string, _timerType: string): Promise<void> {
    // Best-effort no-op for now: pg-boss's singletonKey means a fresh
    // enqueue() for the same (orderId, timerType) after this one fires
    // won't collide, and the worker's defensive re-check makes an
    // already-fired-late job harmless. See TimerSchedulerPort's docstring.
  }

  private async handleDueTimer(data: { orderId: string; timerType: string }): Promise<void> {
    await runSystemTransaction(this.db, this.uow, { role: 'SYSTEM', id: null }, async () => {
      const trx = this.uow.getClient();
      const timer = await trx
        .selectFrom('scheduled_timer')
        .selectAll()
        .where('order_id', '=', data.orderId)
        .where('timer_type', '=', data.timerType)
        .where('cancelled_at', 'is', null)
        .where('fired_at', 'is', null)
        .where('run_at', '<=', new Date())
        .executeTakeFirst();

      if (!timer) {
        this.logger.debug(`due-timer no-op: ${data.orderId}/${data.timerType} already cancelled, fired, or not yet due`);
        return;
      }

      const event = EVENT_BY_TIMER_TYPE[data.timerType];
      if (!event) {
        this.logger.warn(`no event mapping for timer type ${data.timerType}`);
        return;
      }

      let offerCount: number | undefined;
      if (data.timerType === 'BIDDING_DEADLINE') {
        const row = await trx
          .selectFrom('offer')
          .select((eb) => eb.fn.countAll<number>().as('count'))
          .where('order_id', '=', data.orderId)
          .executeTakeFirst();
        offerCount = Number(row?.count ?? 0);
      }

      // customer_sla_expired/supplier_sla_expired land on ESCALATION_REMINDER,
      // whose transition rows schedule the next-tier ESCALATION_TIMEOUT timer
      // using ctx.escalationTimeoutMs — same shorten-for-tests mechanism as
      // ctx.biddingDeadlineMs for BIDDING_DEADLINE.
      const escalationTimeoutMs =
        data.timerType === 'CUSTOMER_SLA' || data.timerType === 'SUPPLIER_SLA'
          ? this.config.get('escalationTimeoutMs', { infer: true })
          : undefined;

      try {
        await this.engine.transition({
          orderId: data.orderId,
          event,
          actor: { role: 'SYSTEM', id: null },
          expectedStateVersion: timer.expected_state_version,
          ctxOverrides: {
            ...(offerCount != null ? { offerCount } : undefined),
            ...(escalationTimeoutMs != null ? { escalationTimeoutMs } : undefined),
          },
        });
      } catch (err) {
        // A stale-state or rejected transition here means the order moved on
        // by other means before the timer fired — safe to treat as a no-op.
        this.logger.debug(`due-timer transition skipped for ${data.orderId}/${data.timerType}: ${(err as Error).message}`);
      }

      await trx
        .updateTable('scheduled_timer')
        .set({ fired_at: new Date() })
        .where('id', '=', timer.id)
        .execute();
    });
  }
}
