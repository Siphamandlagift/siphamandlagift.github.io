import type { NextFunction, RequestHandler, Response } from 'express';
import { AppError } from '../errors.js';
import type { AuthenticatedRequest } from '../types.js';

export function requireCompanyScope(): RequestHandler {
  return (request: AuthenticatedRequest, _response: Response, next: NextFunction) => {
    const companyId = request.auth?.companyId?.trim();

    if (!companyId) {
      next(new AppError('A valid company scope is required for this request.', 403));
      return;
    }

    next();
  };
}