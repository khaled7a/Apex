import { Global, Module } from '@nestjs/common';
import { PgBossTimerScheduler } from './pg-boss-timer-scheduler.service';
import { TIMER_SCHEDULER } from './timer-scheduler.port';

// Both this module and TransitionEngineModule are @Global() and registered
// directly in AppModule, so Nest's DI resolves providers across them without
// either needing to appear in the other's `imports` — that would require
// forwardRef() to break the circular import (this module depends on
// TransitionEngineService; TransitionEngineService optionally depends on
// TIMER_SCHEDULER), which @Global() sidesteps entirely.
@Global()
@Module({
  providers: [PgBossTimerScheduler, { provide: TIMER_SCHEDULER, useExisting: PgBossTimerScheduler }],
  exports: [TIMER_SCHEDULER],
})
export class SchedulerModule {}
