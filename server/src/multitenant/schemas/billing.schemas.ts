import { z } from 'zod';

export const upsertSubscriptionSchema = z.object({
  status: z.enum(['active', 'inactive', 'suspended']),
  activatedAt: z.string().datetime({ offset: true }).nullable().optional(),
  expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export type UpsertSubscriptionRequest = z.infer<typeof upsertSubscriptionSchema>;
