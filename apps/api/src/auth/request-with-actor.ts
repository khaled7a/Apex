import { ActorRef } from '@apex/domain';
import { Request } from 'express';

export interface RequestWithActor extends Request {
  /** Populated by CustomerAuthGuard / SupplierAuthGuard / AdminAuthGuard before DbTransactionInterceptor runs. */
  actor?: ActorRef;
}
