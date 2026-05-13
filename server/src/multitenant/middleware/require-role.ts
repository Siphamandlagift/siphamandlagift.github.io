import type { NextFunction, RequestHandler, Response } from 'express';
import { AppError } from '../errors.js';
import type { AuthenticatedRequest, UserRole } from '../types.js';

export function requireRole(...roles: UserRole[]): RequestHandler {
  return (request: AuthenticatedRequest, _response: Response, next: NextFunction) => {
    const userRole = request.auth?.role;

    if (!userRole || !roles.includes(userRole)) {
      next(new AppError('You do not have permission to perform this action.', 403));
      return;
    }

    next();
  };
}