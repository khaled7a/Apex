import { Global, Module } from '@nestjs/common';
import { TransitionEngineService } from './transition-engine.service';

@Global()
@Module({
  providers: [TransitionEngineService],
  exports: [TransitionEngineService],
})
export class TransitionEngineModule {}
