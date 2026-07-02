import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Kysely, PostgresDialect, sql } from 'kysely';
import { Pool } from 'pg';
import { AppModule } from '../../src/app.module';
import { DB } from '../../src/database/db.types';
import { TransitionExceptionFilter } from '../../src/transition-engine/transition-exception.filter';

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new TransitionExceptionFilter());
  await app.init();
  return app;
}

/** Direct migrator-privileged connection for seeding/assertions the app itself can't do (it only ever connects as app_role). */
export function createAdminDb(): Kysely<DB> {
  return new Kysely<DB>({
    dialect: new PostgresDialect({
      pool: new Pool({ connectionString: 'postgres://apex_migrator:apex_migrator_dev@127.0.0.1:5432/apex_test' }),
    }),
  });
}

const APPLICATION_TABLES = [
  'refund_transaction',
  'dispute_claim',
  'dispute',
  'financial_approval',
  'scheduled_timer',
  'state_transition_log',
  'audit_log',
  'receipt',
  'payment',
  'payment_installment',
  'payment_plan',
  'contract',
  'offer',
  'external_supplier',
  'order',
  'registered_supplier',
  'customer',
  'admin_user',
] as const;

/** Resets all mutable tables between tests — keeps service_type/supplier_category seed rows intact. */
export async function truncateAll(db: Kysely<DB>): Promise<void> {
  const tableList = APPLICATION_TABLES.map((t) => `"${t}"`).join(', ');
  await sql`TRUNCATE TABLE ${sql.raw(tableList)} RESTART IDENTITY CASCADE`.execute(db);
}
