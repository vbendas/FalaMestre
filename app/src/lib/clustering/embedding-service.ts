/**
 * Embedding service for intent clustering.
 * Uses OpenAI's text-embedding-3-small model with 256 dimensions.
 */

import OpenAI from 'openai';
import { db } from '@/db';
import { intentClusters } from '@/db/schema';
import { sql } from 'drizzle-orm';

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
 * Embed a single text string using text-embedding-3-small with 256 dimensions.
 * Returns null if OpenAI key is not configured.
 * 
 * @param text - The text to embed
 * @returns Array of 256 floats or null
 */
export async function embedMessage(text: string): Promise<number[] | null> {
  const openai = getOpenAIClient();
  if (!openai) {
    console.warn('OPENAI_API_KEY not set, skipping embedding');
    return null;
  }

  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      dimensions: 256, // Reduced from 1536 for efficiency
    });

    return response.data[0].embedding;
  } catch (error) {
    console.error('Error generating embedding:', error);
    return null;
  }
}

/**
 * Embed multiple texts in a single API call (batch).
 * OpenAI supports up to 2048 items per call.
 * Splits into batches if more than 2048 items.
 * 
 * @param texts - Array of texts to embed
 * @returns Array of embeddings (or null for failed items)
 */
export async function embedBatch(texts: string[]): Promise<(number[] | null)[]> {
  const openai = getOpenAIClient();
  if (!openai) {
    console.warn('OPENAI_API_KEY not set, skipping batch embedding');
    return texts.map(() => null);
  }

  const results: (number[] | null)[] = [];
  const BATCH_SIZE = 2048;

  // Process in batches
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    try {
      const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: batch,
        dimensions: 256,
      });

      // Map results back to original order
      const batchResults = response.data.map(d => d.embedding);
      results.push(...batchResults);
    } catch (error) {
      console.error('Error generating batch embeddings:', error);
      // Fill with nulls for failed batch
      results.push(...batch.map(() => null));
    }
  }

  return results;
}

/**
 * Classify a message against known intent clusters using pgvector cosine distance.
 * Finds the nearest centroid in the intent_clusters table.
 * Returns null if no clusters exist.
 * 
 * @param embedding - The message embedding (256 dimensions)
 * @returns Cluster id and confidence score, or null
 */
export async function classifyIntentByEmbedding(
  embedding: number[]
): Promise<{ cluster: string; confidence: number } | null> {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  try {
    // Query using pgvector cosine distance
    // 1 - (embedding <=> centroid) gives cosine similarity
    const result = await db.execute(sql`
      SELECT id, label, 1 - (centroid <=> ${sql.raw(`'[${embedding.join(',')}]'::vector`)}) as similarity
      FROM intent_clusters
      WHERE is_active = true
      ORDER BY centroid <=> ${sql.raw(`'[${embedding.join(',')}]'::vector`)}
      LIMIT 1
    `);

    if (result.length === 0) {
      return null;
    }

    const row = result[0] as { id: string; label: string; similarity: number };
    
    return {
      cluster: row.id,
      confidence: row.similarity,
    };
  } catch (error) {
    console.error('Error classifying intent by embedding:', error);
    return null;
  }
}