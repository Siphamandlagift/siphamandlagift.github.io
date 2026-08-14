import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';

const passwordKeyLength = 64;
const minimumPasswordLength = 12;
const passwordComplexityPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).+$/;

const defaultDemoCredentialMap = {
  administrator: {
    allowedUsernames: new Set(['admin', 'admin@skillsconnect.app']),
    defaultPassword: 'admin',
  },
  'training-manager': {
    allowedUsernames: new Set(['manager', 'ava.mokoena@skillsconnect.app']),
    defaultPassword: 'manager',
  },
  student: {
    allowedUsernames: new Set(['student', 'alice.johnson@skillsconnect.app']),
    defaultPassword: 'student',
  },
} as const;

export const passwordPolicyMessage = `Password must be at least ${minimumPasswordLength} characters and include uppercase, lowercase, number, and symbol.`;

export function isStrongPassword(password: string) {
  const normalizedPassword = password.trim();
  return normalizedPassword.length >= minimumPasswordLength && passwordComplexityPattern.test(normalizedPassword);
}

export function shouldBlockDefaultDemoCredentialLogin() {
  const allowDemoCredentials = process.env['LMS_ALLOW_DEMO_CREDENTIALS']?.trim().toLowerCase() === 'true';
  const isHostedRuntime = Boolean(process.env['K_SERVICE'] || process.env['FUNCTION_TARGET'] || process.env['FUNCTION_NAME']);
  return isHostedRuntime && !allowDemoCredentials;
}

export function isDefaultDemoCredentialLogin(role: 'administrator' | 'training-manager' | 'student', usernameOrEmail: string, password: string) {
  const normalizedUsername = usernameOrEmail.trim().toLowerCase();
  const normalizedPassword = password.trim();
  const roleDefaults = defaultDemoCredentialMap[role];

  return roleDefaults.allowedUsernames.has(normalizedUsername) && roleDefaults.defaultPassword === normalizedPassword;
}

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