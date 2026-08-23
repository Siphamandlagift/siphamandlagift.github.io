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

      if (!subscription) {
        next(
          new AppError(
            'Your account is not yet active. Please contact us to activate your subscription.',
            402,
          ),
        );
        return;
      }

      // Allow-list rather than the previous "block if inactive, block if suspended" deny-list: the
      // Firestore document's status field is loosely typed as string (CompanyDoc), not runtime-
      // validated against the SubscriptionStatus union, so any value that's neither the literal
      // 'inactive' nor 'suspended' — a typo, a legacy/future status, or a hand-edit made through
      // the Firestore console (the only way to fix a stuck subscription today, since there's no
      // other write path outside the validated PUT /billing/:companyId) — used to fall through
      // both checks and be treated as fully active. Requiring the exact 'active' value instead
      // fails closed on anything unexpected.
      if (subscription.status !== 'active') {
        next(
          new AppError(
            subscription.status === 'suspended'
              ? 'Your account has been suspended. Please contact billing to resolve this.'
              : 'Your account is not yet active. Please contact us to activate your subscription.',
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
