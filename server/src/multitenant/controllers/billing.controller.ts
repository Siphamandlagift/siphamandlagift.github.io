import type { RequestHandler } from 'express';
import type { UpsertSubscriptionRequest } from '../schemas/billing.schemas.js';
import type { AuthenticatedRequest } from '../types.js';
import type { BillingService } from '../services/billing.service.js';

export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  /** GET /billing — platform admin: list all tenants with subscription status */
  readonly listAll: RequestHandler = async (_request, response) => {
    const companies = await this.billingService.listAll();
    response.json(companies);
  };

  /** GET /billing/me — tenant admin: get own subscription + usage */
  readonly getMySubscription: RequestHandler = async (request, response) => {
    const authenticatedRequest = request as AuthenticatedRequest;
    const { companyId, licenseType } = authenticatedRequest.auth!;
    const summary = await this.billingService.getUsageSummary(companyId, licenseType);
    response.json(summary);
  };

  /** PUT /billing/:companyId — platform admin: activate/suspend/deactivate a tenant */
  readonly updateSubscription: RequestHandler = async (request, response) => {
    const companyId = request.params['companyId'] as string;
    const payload = request.body as UpsertSubscriptionRequest;
    const updated = await this.billingService.updateSubscription(companyId, payload);
    response.json(updated);
  };
}
