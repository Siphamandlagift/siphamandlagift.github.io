import type { NextFunction, RequestHandler, Response } from 'express';
import type { MultiTenantConfig } from '../config.js';
import { AppError } from '../errors.js';
import { verifyAuthToken } from '../auth/jwt.js';
import type { AuthenticatedRequest } from '../types.js';
import type { MultiTenantRepository } from '../repositories/multitenant.repository.js';

function getBearerToken(headerValue: string | undefined) {
  if (!headerValue?.startsWith('Bearer ')) {
    return null;
  }

  return headerValue.slice(7).trim();
}

export function authenticateRequest(repository: MultiTenantRepository, config: MultiTenantConfig): RequestHandler {
  return async (request: AuthenticatedRequest, _response: Response, next: NextFunction) => {
    try {
      const token = getBearerToken(request.headers.authorization);

      if (!token) {
        throw new AppError('Authentication token is required.', 401);
      }

      const payload = verifyAuthToken(token, config);
      const user = await repository.findAuthenticatedUser(payload.userId, payload.companyId);

      if (!user) {
        throw new AppError('Authenticated user could not be found for this company.', 401);
      }

      request.auth = user;
      next();
    } catch (error) {
      next(error instanceof AppError ? error : new AppError('Invalid or expired authentication token.', 401));
    }
  };
}