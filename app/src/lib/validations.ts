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

export const matchRequestSchema = z.object({
  userId: z.string()
    .min(1, 'User ID is required')
    .max(100, 'User ID too long')
    .regex(/^user_[a-z0-9]{9}$/, 'Invalid user ID format'),
});

export const userIdParamSchema = z.object({
  userId: z.string()
    .regex(/^user_[a-z0-9]{9}$/, 'Invalid user ID format'),
});

export type ConversationRequest = z.infer<typeof conversationRequestSchema>;
export type MatchRequest = z.infer<typeof matchRequestSchema>;
export type UserIdParam = z.infer<typeof userIdParamSchema>;
