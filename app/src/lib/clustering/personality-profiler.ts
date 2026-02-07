/**
 * Personality profiler using GPT-4o-mini.
 * Assesses Big Five (OCEAN) personality traits from accumulated chat messages.
 */

import OpenAI from 'openai';
import { db } from '@/db';
import { conversations, userProfiles } from '@/db/schema';
import { and, eq, gt, isNotNull, sql } from 'drizzle-orm';
import { PersonalityProfile } from './types';

// Lazy initialization of OpenAI client
let openaiClient: OpenAI | null = null;
function getOpenAIClient(): OpenAI | null {
  if (!openaiClient && process.env.OPENAI_API_KEY) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

/**
 * Assess Big Five (OCEAN) personality traits from accumulated chat messages.
 * Uses GPT-4o-mini with structured JSON output.
 * 
 * Minimum messages: 15 (below this, returns null)
 * Optimal messages: 50-100
 * Confidence formula: min(1.0, messageCount / 100)
 * 
 * @param messages - Array of the user's recent messages (Portuguese text, max 100)
 * @returns PersonalityProfile with scores 0.0-1.0 and confidence, or null
 */
export async function assessPersonality(
  messages: string[]
): Promise<PersonalityProfile | null> {
  // Check minimum messages
  if (messages.length < 15) {
    return null;
  }

  // Cap at 100 messages
  const messageBlock = messages.slice(-100).map((m, i) => `${i + 1}. ${m}`).join('\n');

  // Get OpenAI client (returns null if no API key)
  const openai = getOpenAIClient();
  if (!openai) {
    console.warn('OPENAI_API_KEY not set, skipping personality assessment');
    return null;
  }

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a psycholinguistic analyst. Analyze the writing patterns in these chat messages from a Brazilian football management game. The messages are in Portuguese.

Assess the Big Five (OCEAN) personality traits based ONLY on linguistic patterns:
- Word choice, sentence structure, emotional expression
- Question-asking frequency → Openness (curious, exploring new features)
- Planning/strategic language → Conscientiousness (organized, methodical)
- Social references, exclamations → Extraversion (outgoing, energetic)
- Cooperative vs competitive language → Agreeableness (friendly vs competitive)
- Anxiety markers, hedging language → Neuroticism (emotional stability)

Return JSON only with these exact keys: openness, conscientiousness, extraversion, agreeableness, neuroticism. Each value should be a number between 0.0 (very low) and 1.0 (very high).`,
        },
        {
          role: 'user',
          content: `Analyze these ${messages.length} messages:\n${messageBlock}`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2,
      max_tokens: 200,
    });

    const content = response.choices[0].message.content;
    if (!content) {
      return null;
    }

    const parsed = JSON.parse(content);

    // Clamp values to 0-1 range
    const clamp = (val: number) => Math.max(0, Math.min(1, val ?? 0.5));

    // Confidence increases with message count (diminishing returns after ~100)
    const confidence = Math.min(1.0, messages.length / 100);

    return {
      openness: clamp(parsed.openness ?? 0.5),
      conscientiousness: clamp(parsed.conscientiousness ?? 0.5),
      extraversion: clamp(parsed.extraversion ?? 0.5),
      agreeableness: clamp(parsed.agreeableness ?? 0.5),
      neuroticism: clamp(parsed.neuroticism ?? 0.5),
      confidence,
      messageCount: messages.length,
      assessedAt: new Date(),
    };
  } catch (error) {
    console.error('Error assessing personality:', error);
    return null;
  }
}

/**
 * Get user IDs that have 15+ new messages since their last personality assessment.
 * Queries conversations table joined with user_profiles.personalityLastAssessedAt.
 * 
 * @returns Array of user IDs
 */
export async function getUsersNeedingAssessment(): Promise<string[]> {
  if (!process.env.DATABASE_URL) {
    return [];
  }

  try {
    // Find users with 15+ messages since last assessment
    const result = await db.execute(sql`
      SELECT 
        c.user_id,
        COUNT(*) as message_count
      FROM conversations c
      LEFT JOIN user_profiles up ON c.user_id = up.user_id
      WHERE c.message_type = 'user'
        AND (
          up.personality_last_assessed_at IS NULL
          OR c.created_at > up.personality_last_assessed_at
        )
      GROUP BY c.user_id
      HAVING COUNT(*) >= 15
    `);

    return (result as { user_id: string }[]).map(r => r.user_id);
  } catch (error) {
    console.error('Error getting users needing assessment:', error);
    return [];
  }
}

/**
 * Get the last N messages for a user from the conversations table.
 * Only returns messages where messageType = 'user'.
 * 
 * @param userId - The user ID
 * @param limit - Maximum number of messages (default 100)
 * @returns Array of message content strings
 */
export async function getUserMessages(
  userId: string,
  limit: number = 100
): Promise<string[]> {
  if (!process.env.DATABASE_URL) {
    return [];
  }

  try {
    const result = await db
      .select({ content: conversations.content })
      .from(conversations)
      .where(and(
        eq(conversations.userId, userId),
        eq(conversations.messageType, 'user'),
        isNotNull(conversations.content)
      ))
      .orderBy(sql`${conversations.createdAt} DESC`)
      .limit(limit);

    return result
      .map((r: { content: string | null }) => r.content)
      .filter((content: string | null): content is string => content !== null);
  } catch (error) {
    console.error('Error getting user messages:', error);
    return [];
  }
}