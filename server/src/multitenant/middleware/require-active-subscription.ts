import type { NextFunction, RequestHandler, Response } from 'express';
import { AppError } from '../errors.js';
import type { MultiTenantRepository } from '../repositories/multitenant.repository.js';
import type { AuthenticatedRequest } from '../types.js';

/**
 * Blocks requests from tenants whose subscription is not active or has expired.
 * Apply this after authenticateRequest + requireCompanyScope on all protected routes.
 */
export function requireActiveSubscription(repository: MultiTenantRepository): RequestHandler {
  return async (request: AuthenticatedRequest, _response: Response, next: NextFunction) => {
    const companyId = request.auth?.companyId;

    if (!companyId) {
      next(new AppError('A valid company scope is required for this request.', 403));
      return;
    }

    try {
      const subscription = await repository.getSubscription(companyId);

      if (!subscription || subscription.status === 'inactive') {
        next(
          new AppError(
            'Your account is not yet active. Please contact us to activate your subscription.',
            402,
          ),
        );
        return;
      }

      if (subscription.status === 'suspended') {
        next(
          new AppError(
            'Your account has been suspended. Please contact billing to resolve this.',
            402,
          ),
        );
        return;
      }

      if (subscription.expiresAt && new Date(subscription.expiresAt) < new Date()) {
        next(
          new AppError(
            'Your subscription has expired. Please renew to continue using the platform.',
            402,
          ),
        );
        return;
      }

      next();
    } catch (error) {
      next(error);
    }
  };
}
