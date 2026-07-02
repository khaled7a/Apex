import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ActorRef } from '@apex/domain';
import { RequestWithActor } from '../request-with-actor';

@Injectable()
export class AdminAuthGuard extends AuthGuard('jwt-admin') {
  handleRequest<TUser = ActorRef>(err: unknown, user: TUser, info: unknown, context: ExecutionContext): TUser {
    const actor = super.handleRequest(err, user, info, context) as TUser;
    const request = context.switchToHttp().getRequest<RequestWithActor>();
    request.actor = actor as unknown as RequestWithActor['actor'];
    return actor;
  }
}
