import type { MultiTenantRepository } from '../repositories/multitenant.repository.js';

export class UserService {
  constructor(private readonly repository: MultiTenantRepository) {}

  listUsers(companyId: string) {
    return this.repository.listUsersByCompany(companyId);
  }
}