import bcrypt from 'bcrypt';

export async function hashPassword(password: string, saltRounds: number) {
  return bcrypt.hash(password, saltRounds);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}