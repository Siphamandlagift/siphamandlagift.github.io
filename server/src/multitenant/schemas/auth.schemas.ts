import { z } from 'zod';

export const registerSchema = z.object({
  companyName: z.string().trim().min(2),
  licenseType: z.enum(['starter', 'growth', 'enterprise']),
  name: z.string().trim().min(2),
  email: z.string().trim().email(),
  password: z.string().min(8),
});

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

export type RegisterRequest = z.infer<typeof registerSchema>;
export type LoginRequest = z.infer<typeof loginSchema>;