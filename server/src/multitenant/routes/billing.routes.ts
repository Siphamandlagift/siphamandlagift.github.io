import { Router } from 'express';
import { BillingController } from '../controllers/billing.controller.js';
import { asyncHandler } from '../middleware/async-handler.js';
import { requirePlatformAdmin } from '../middleware/require-platform-admin.js';
import { validateRequest } from '../middleware/validate-request.js';
import { upsertSubscriptionSchema } from '../schemas/billing.schemas.js';

export function createBillingRoutes(controller: BillingController) {
  const router = Router();

  // Any authenticated tenant user can read their own subscription + usage.
  router.get('/me', asyncHandler(controller.getMySubscription));

  // Platform admin only: list all tenants and manage subscriptions.
  router.get('/', requirePlatformAdmin(), asyncHandler(controller.listAll));
  router.put(
    '/:companyId',
    requirePlatformAdmin(),
    validateRequest({ body: upsertSubscriptionSchema }),
    asyncHandler(controller.updateSubscription),
  );

  return router;
}
