import { Global, Inject, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { DB } from './db.types';
import { UnitOfWork } from './unit-of-work';
import { AppConfig } from '../config/configuration';

export const KYSELY = Symbol('KYSELY');

@Global()
@Module({
  providers: [
    {
      provide: KYSELY,
      inject: [ConfigService],
      useFactory: (config: ConfigService<AppConfig, true>) => {
        const pool = new Pool({ connectionString: config.get('appDatabaseUrl', { infer: true }) });
        return new Kysely<DB>({ dialect: new PostgresDialect({ pool }) });
      },
    },
    UnitOfWork,
  ],
  exports: [KYSELY, UnitOfWork],
})
export class DatabaseModule implements OnModuleDestroy {
  constructor(@Inject(KYSELY) private readonly db: Kysely<DB>) {}

  async onModuleDestroy() {
    // Actually closes the pg Pool — without this, every test run (and every
    // graceful shutdown) leaks open connections, which is exactly what was
    // causing Jest to report "did not exit one second after the test run".
    await this.db.destroy();
  }
}
