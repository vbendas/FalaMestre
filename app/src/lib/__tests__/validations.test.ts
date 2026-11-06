import { describe, it, expect } from 'vitest';
import { conversationRequestSchema, isValidUserId, userIdSchema } from '../validations';

describe('userIdSchema', () => {
  it('accepts a locally generated game id', () => {
    expect(userIdSchema.parse('user_abc123xyz')).toBe('user_abc123xyz');
  });

  it("accepts an auth provider's subject id, which owns a signed-in player's save", () => {
    expect(userIdSchema.parse('109427834512345678901')).toBe('109427834512345678901');
  });

  it('rejects an empty id', () => {
    expect(() => userIdSchema.parse('')).toThrow();
  });

  it('rejects ids carrying characters that are not part of any id we issue', () => {
    for (const value of ['user_abc/../x', 'user abc', "user_'; drop", 'user_ação']) {
      expect(isValidUserId(value)).toBe(false);
    }
  });

  it('rejects an id over the length cap', () => {
    expect(isValidUserId('u'.repeat(101))).toBe(false);
  });

  it('is the id shape the conversation request uses', () => {
    const parsed = conversationRequestSchema.parse({
      userId: '109427834512345678901',
      message: 'Oi, mestre',
    });
    expect(parsed.userId).toBe('109427834512345678901');
  });
});
