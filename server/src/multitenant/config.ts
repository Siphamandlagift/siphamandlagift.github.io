export type MultiTenantConfig = {
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  corsOrigin: string[];
  bcryptSaltRounds: number;
};

export function getMultiTenantConfig(): MultiTenantConfig {
  const configuredCorsOrigins = (process.env['MULTITENANT_CORS_ORIGIN'] || 'http://localhost:4200')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return {
    port: Number(process.env['PORT'] || process.env['MULTITENANT_API_PORT'] || 3001),
    databaseUrl: process.env['MULTITENANT_DATABASE_URL'] || 'postgresql://postgres:postgres@localhost:5432/lms_multitenant',
    jwtSecret: process.env['MULTITENANT_JWT_SECRET'] || 'local-development-secret-change-me',
    jwtExpiresIn: process.env['MULTITENANT_JWT_EXPIRES_IN'] || '8h',
    corsOrigin: configuredCorsOrigins,
    bcryptSaltRounds: Number(process.env['MULTITENANT_BCRYPT_SALT_ROUNDS'] || 10),
  };
}