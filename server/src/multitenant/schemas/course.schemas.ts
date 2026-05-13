import { z } from 'zod';

export const createCourseSchema = z.object({
  title: z.string().trim().min(2),
});

export type CreateCourseRequest = z.infer<typeof createCourseSchema>;

export const updateProgressSchema = z.object({
  progress: z.number().int().min(0).max(100),
});

export type UpdateProgressRequest = z.infer<typeof updateProgressSchema>;