import { SetMetadata } from '@nestjs/common';
import { PermissionAction } from '@apex/domain';

export const PERMISSION_KEY = 'requiresPermission';

/** Ties a controller method to one row of the RBAC matrix in packages/domain/src/permissions/permission-matrix.const.ts. */
export const RequiresPermission = (action: PermissionAction) => SetMetadata(PERMISSION_KEY, action);
