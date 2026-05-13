import type { NextFunction, RequestHandler, Response } from 'express';
import { AppError } from '../errors.js';
import type { Permission } from '../rbac.js';
import type { AuthenticatedRequest } from '../types.js';

export function requirePermission(...permissions: Permission[]): RequestHandler {
  return (request: AuthenticatedRequest, _response: Response, next: NextFunction) => {
    const userPermissions = request.auth?.permissions ?? [];

    if (!permissions.length || permissions.some((permission) => userPermissions.includes(permission))) {
      next();
      return;
    }

    next(new AppError('You do not have permission to perform this action.', 403));
  };
}