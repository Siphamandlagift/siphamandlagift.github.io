import type { NextFunction, RequestHandler, Response } from 'express';
import { AppError } from '../errors.js';
import type { AuthenticatedRequest } from '../types.js';

/**
 * Restricts a route to platform administrators only (is_platform_admin = true in DB).
 * This is different from a tenant 'admin' role — platform admins can see and manage
 * all companies across the entire system.
 */
export function requirePlatformAdmin(): RequestHandler {
  return (request: AuthenticatedRequest, _response: Response, next: NextFunction) => {
    if (!request.auth?.isPlatformAdmin) {
      next(new AppError('This action requires platform administrator access.', 403));
      return;
    }

    next();
  };
}
