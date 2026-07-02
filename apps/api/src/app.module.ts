import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DatabaseModule } from './database/database.module';
import { DbTransactionInterceptor } from './database/db-transaction.interceptor';
import { loadConfig } from './config/configuration';
import { AuthModule } from './auth/auth.module';
import { TransitionEngineModule } from './transition-engine/transition-engine.module';
import { AuditModule } from './audit/audit.module';
import { FinancialApprovalModule } from './financial-approval/financial-approval.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { OrdersModule } from './orders/orders.module';
import { BiddingModule } from './bidding/bidding.module';
import { ContractsModule } from './contracts/contracts.module';
import { PaymentsModule } from './payments/payments.module';
import { DisputesModule } from './disputes/disputes.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '../../.env', load: [loadConfig] }),
    DatabaseModule,
    AuthModule,
    TransitionEngineModule,
    AuditModule,
    FinancialApprovalModule,
    SchedulerModule,
    OrdersModule,
    BiddingModule,
    ContractsModule,
    PaymentsModule,
    DisputesModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_INTERCEPTOR, useClass: DbTransactionInterceptor }],
})
export class AppModule {}
