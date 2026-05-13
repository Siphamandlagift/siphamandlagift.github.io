import { Pool } from 'pg';
import type { MultiTenantConfig } from './config.js';

export function createDatabasePool(config: MultiTenantConfig) {
  return new Pool({
    connectionString: config.databaseUrl,
  });
}