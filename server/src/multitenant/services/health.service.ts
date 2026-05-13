import type { MultiTenantRepository } from '../repositories/multitenant.repository.js';

export class HealthService {
  constructor(private readonly repository: MultiTenantRepository) {}

  async getHealthStatus() {
    await this.repository.healthCheck();
    return { status: 'ok' };
  }
}