import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';

const passwordKeyLength = 64;

export function createPasswordCredentials(password: string) {
  const passwordSalt = randomBytes(16).toString('hex');
  const passwordHash = hashPassword(password, passwordSalt);
  return { passwordHash, passwordSalt };
}

export function hashPassword(password: string, passwordSalt: string) {
  return scryptSync(password, passwordSalt, passwordKeyLength).toString('hex');
}

export function verifyPassword(password: string, passwordSalt: string, expectedPasswordHash: string) {
  const actualHash = Buffer.from(hashPassword(password, passwordSalt), 'hex');
  const expectedHash = Buffer.from(expectedPasswordHash, 'hex');

  if (actualHash.length !== expectedHash.length) {
    return false;
  }

  return timingSafeEqual(actualHash, expectedHash);
}

export function generatePasswordResetToken() {
  return randomBytes(32).toString('hex');
}

export function hashPasswordResetToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}