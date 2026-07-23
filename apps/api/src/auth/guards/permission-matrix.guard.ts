import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { isActionAllowed, PermissionAction } from '@apex/domain';
import { PERMISSION_KEY } from '../decorators/requires-permission.decorator';
import { RequestWithActor } from '../request-with-actor';

/**
 * Enforces docs/data-model.md §1 at the API boundary. This is the ONLY place
 * a permission decision is made — the same PERMISSION_MATRIX constant this
 * reads from is also what a future admin UI would use to hide/show buttons,
 * so there is never a second, silently-drifting copy of "who can do this."
 */
@Injectable()
export class PermissionMatrixGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const action = this.reflector.get<PermissionAction | undefined>(PERMISSION_KEY, context.getHandler());
    if (!action) return true; // no @RequiresPermission on this route — nothing to enforce here

    const request = context.switchToHttp().getRequest<RequestWithActor>();
    const actor = request.actor;
    if (!actor) {
      throw new ForbiddenException('no authenticated actor for permission check');
    }
    if (!isActionAllowed(action, actor.role)) {
      throw new ForbiddenException(`role ${actor.role} is not permitted to perform ${action}`);
    }
    return true;
  }
}
