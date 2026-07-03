import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ActorRef } from '@apex/domain';
import { RequestWithActor } from '../request-with-actor';

/**
 * Accepts a bearer token from ANY of the three JWT audiences — passport
 * tries jwt-customer/jwt-supplier/jwt-admin in order and uses whichever
 * validates. For actions any legitimately-authenticated actor type might
 * need (uploading/downloading a file attached to an order they can already
 * see) rather than duplicating the same endpoint three times per role, as
 * every *other* multi-role action in this codebase does (that pattern fits
 * when the three roles take genuinely different actions; here they take the
 * exact same one).
 */
@Injectable()
export class AnyActorAuthGuard extends AuthGuard(['jwt-customer', 'jwt-supplier', 'jwt-admin']) {
  handleRequest<TUser = ActorRef>(err: unknown, user: TUser, info: unknown, context: ExecutionContext): TUser {
    const actor = super.handleRequest(err, user, info, context) as TUser;
    const request = context.switchToHttp().getRequest<RequestWithActor>();
    request.actor = actor as unknown as RequestWithActor['actor'];
    return actor;
  }
}
