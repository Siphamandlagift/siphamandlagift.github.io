import jwt, { type SignOptions } from 'jsonwebtoken';
import type { MultiTenantConfig } from '../config.js';
import type { AuthTokenPayload } from '../types.js';

export function signAuthToken(payload: AuthTokenPayload, config: MultiTenantConfig) {
  const signOptions: SignOptions = {
    expiresIn: config.jwtExpiresIn as SignOptions['expiresIn'],
  };

  return jwt.sign(payload, config.jwtSecret, {
    ...signOptions,
  });
}

export function verifyAuthToken(token: string, config: MultiTenantConfig) {
  return jwt.verify(token, config.jwtSecret) as AuthTokenPayload;
}