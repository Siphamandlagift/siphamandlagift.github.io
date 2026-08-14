import type { MultiTenantRepository } from '../repositories/multitenant.repository.js';
import { AppError } from '../errors.js';
import { PLAN_LIMITS } from '../types.js';
import type { UpsertSubscriptionInput } from '../types.js';

export class BillingService {
  constructor(private readonly repository: MultiTenantRepository) {}

  /** List all companies with their subscription status and usage counts (platform admin only). */
  listAll() {
    return this.repository.listAllCompaniesWithSubscription();
  }

  /** Get the subscription for a single tenant (used in the tenant dashboard). */
  async getSubscription(companyId: string) {
    const sub = await this.repository.getSubscription(companyId);

    if (!sub) {
      throw new AppError('Subscription record not found for this company.', 404);
    }

    return sub;
  }

  /** Platform admin: activate, suspend, or deactivate a tenant subscription. */
  async updateSubscription(companyId: string, input: UpsertSubscriptionInput) {
    if (!companyId.trim()) {
      throw new AppError('companyId is required.', 400);
    }

    return this.repository.upsertSubscription(companyId, input);
  }

  /** Returns current usage and plan limits for a tenant — shown in their dashboard. */
  async getUsageSummary(companyId: string, licenseType: string) {
    const limits = PLAN_LIMITS[licenseType as keyof typeof PLAN_LIMITS] ?? { maxUsers: null, maxCourses: null };

    const [userCount, courseCount, subscription] = await Promise.all([
      this.repository.countUsersForCompany(companyId),
      this.repository.countCoursesForCompany(companyId),
      this.repository.getSubscription(companyId),
    ]);

    return {
      licenseType,
      subscription,
      usage: { userCount, courseCount },
      limits,
    };
  }
}
