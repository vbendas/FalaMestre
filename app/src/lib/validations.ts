import { z } from 'zod';

export const conversationRequestSchema = z.object({
  userId: z.string()
    .min(1, 'User ID is required')
    .max(100, 'User ID too long')
    .regex(/^user_[a-z0-9]{9}$/, 'Invalid user ID format'),
  message: z.string()
    .min(1, 'Message is required')
    .max(2000, 'Message too long (max 2000 characters)')
    .transform(val => val.trim())
    .refine(val => val.length > 0, 'Message cannot be only whitespace'),
  useMock: z.boolean().optional(),
});

/**
 * Optional replay seed accepted by the match routes. A short token or an
 * integer: both hash cleanly in rng.ts and both round-trip through JSON
 * unchanged, so the seed a response reports can be sent straight back.
 */
export const seedSchema = z.union([
  z.string().regex(/^[A-Za-z0-9_.:-]{1,64}$/, 'seed must be 1-64 letters, digits, or _ . : -'),
  z.number()
    .int('seed must be an integer')
    .min(Number.MIN_SAFE_INTEGER, 'seed is out of range')
    .max(Number.MAX_SAFE_INTEGER, 'seed is out of range'),
]);

export type Seed = z.infer<typeof seedSchema>;

export const matchRequestSchema = z.object({
  userId: z.string()
    .min(1, 'User ID is required')
    .max(100, 'User ID too long')
    .regex(/^user_[a-z0-9]{9}$/, 'Invalid user ID format'),
  seed: seedSchema.optional(),
});

export const userIdParamSchema = z.object({
  userId: z.string()
    .regex(/^user_[a-z0-9]{9}$/, 'Invalid user ID format'),
});

export type ConversationRequest = z.infer<typeof conversationRequestSchema>;
export type MatchRequest = z.infer<typeof matchRequestSchema>;
export type UserIdParam = z.infer<typeof userIdParamSchema>;
