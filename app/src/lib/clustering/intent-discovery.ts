/**
 * Intent discovery engine.
 * Discovers intent clusters from message embeddings using K-means clustering.
 */

import { db } from '@/db';
import { messageEmbeddings, intentClusters, conversations } from '@/db/schema';
import { sql } from 'drizzle-orm';
import { embedBatch } from './embedding-service';
import OpenAI from 'openai';

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
 * Discover intent clusters from recent message embeddings.
 * 
 * Algorithm:
 * 1. Fetch up to 2000 embeddings from message_embeddings (last 7 days)
 * 2. K-means++ initialization
 * 3. Run 15 iterations of assign + recompute centroids
 * 4. Try K = 8, 10, 12, 15, 20 - pick K with best silhouette score
 * 5. For each cluster, sample 15 messages and call GPT-4o-mini to generate label
 * 6. Upsert results into intent_clusters table
 * 7. Back-fill intentCluster on message_embeddings rows
 * 
 * @returns Discovery results with cluster count and labels
 */
export async function discoverIntentClusters(): Promise<{
  clustersFound: number;
  messagesProcessed: number;
  labels: Array<{ id: string; label: string; count: number }>;
}> {
  if (!process.env.DATABASE_URL || !process.env.OPENAI_API_KEY) {
    return {
      clustersFound: 0,
      messagesProcessed: 0,
      labels: [],
    };
  }

  try {
    // 1. Fetch embeddings from last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    
    const embeddingsResult = await db.execute(sql`
      SELECT id, content, embedding
      FROM message_embeddings
      WHERE created_at >= ${sevenDaysAgo}
        AND embedding IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 2000
    `);

    const embeddings = embeddingsResult as Array<{
      id: string;
      content: string;
      embedding: number[];
    }>;

    if (embeddings.length < 50) {
      console.log('Not enough embeddings for clustering, need at least 50');
      return {
        clustersFound: 0,
        messagesProcessed: embeddings.length,
        labels: [],
      };
    }

    // 2. Try different K values and pick best
    const kValues = [8, 10, 12, 15, 20];
    let bestK = 10;
    let bestScore = -1;
    let bestAssignments: number[] = [];
    let bestCentroids: number[][] = [];

    for (const k of kValues) {
      const { assignments, centroids } = runKMeans(
        embeddings.map(e => e.embedding),
        k,
        15
      );

      // Calculate simplified silhouette score (sample 500 vectors for speed)
      const score = calculateSilhouetteScore(
        embeddings.map(e => e.embedding),
        assignments,
        500
      );

      if (score > bestScore) {
        bestScore = score;
        bestK = k;
        bestAssignments = assignments;
        bestCentroids = centroids;
      }
    }

    // 3. Label clusters using GPT-4o-mini
    const clusterLabels: Array<{ id: string; label: string; description: string; descriptionPt: string; count: number }> = [];

    for (let clusterIdx = 0; clusterIdx < bestK; clusterIdx++) {
      // Get messages in this cluster
      const clusterMessages = embeddings
        .filter((_, i) => bestAssignments[i] === clusterIdx)
        .map(e => e.content)
        .slice(0, 15);

      if (clusterMessages.length === 0) continue;

      // Generate label
      const label = await generateClusterLabel(clusterMessages);
      
      clusterLabels.push({
        id: label.id,
        label: label.label,
        description: label.description,
        descriptionPt: label.descriptionPt,
        count: clusterMessages.length,
      });

      // 4. Upsert to intent_clusters table
      await db.insert(intentClusters)
        .values({
          id: label.id,
          label: label.label,
          description: label.description,
          descriptionPt: label.descriptionPt,
          centroid: bestCentroids[clusterIdx],
          messageCount: clusterMessages.length,
          discoveredAt: new Date(),
          isActive: true,
        })
        .onConflictDoUpdate({
          target: intentClusters.id,
          set: {
            centroid: bestCentroids[clusterIdx],
            messageCount: clusterMessages.length,
            discoveredAt: new Date(),
            isActive: true,
          },
        });

      // 5. Back-fill intentCluster on message_embeddings
      const clusterEmbeddingIds = embeddings
        .filter((_, i) => bestAssignments[i] === clusterIdx)
        .map(e => e.id);

      for (const id of clusterEmbeddingIds) {
        await db.execute(sql`
          UPDATE message_embeddings
          SET intent_cluster = ${label.id}
          WHERE id = ${id}
        `);
      }
    }

    // Deactivate old clusters
    await db.execute(sql`
      UPDATE intent_clusters
      SET is_active = false
      WHERE discovered_at < ${sevenDaysAgo}
    `);

    return {
      clustersFound: clusterLabels.length,
      messagesProcessed: embeddings.length,
      labels: clusterLabels.map(c => ({ id: c.id, label: c.label, count: c.count })),
    };
  } catch (error) {
    console.error('Error discovering intent clusters:', error);
    return {
      clustersFound: 0,
      messagesProcessed: 0,
      labels: [],
    };
  }
}

/**
 * Run K-means clustering on embeddings.
 * 
 * @param vectors - Array of embedding vectors
 * @param k - Number of clusters
 * @param maxIterations - Maximum iterations
 * @returns Assignments and centroids
 */
function runKMeans(
  vectors: number[][],
  k: number,
  maxIterations: number
): { assignments: number[]; centroids: number[][] } {
  const n = vectors.length;
  const dim = vectors[0].length;

  // K-means++ initialization
  const centroids: number[][] = [vectors[Math.floor(Math.random() * n)]];

  while (centroids.length < k) {
    const distances = vectors.map(v => {
      const minDist = Math.min(...centroids.map(c => euclideanDistance(v, c)));
      return minDist * minDist; // Square distance for probability
    });

    const totalDist = distances.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalDist;
    
    for (let i = 0; i < n; i++) {
      random -= distances[i];
      if (random <= 0) {
        centroids.push(vectors[i]);
        break;
      }
    }
  }

  // K-means iterations
  let assignments = new Array(n).fill(0);

  for (let iter = 0; iter < maxIterations; iter++) {
    // Assign each vector to nearest centroid
    let changed = false;
    for (let i = 0; i < n; i++) {
      let bestCluster = 0;
      let bestDist = euclideanDistance(vectors[i], centroids[0]);

      for (let j = 1; j < k; j++) {
        const dist = euclideanDistance(vectors[i], centroids[j]);
        if (dist < bestDist) {
          bestDist = dist;
          bestCluster = j;
        }
      }

      if (assignments[i] !== bestCluster) {
        assignments[i] = bestCluster;
        changed = true;
      }
    }

    // Recompute centroids
    for (let j = 0; j < k; j++) {
      const clusterVectors = vectors.filter((_, i) => assignments[i] === j);
      if (clusterVectors.length > 0) {
        centroids[j] = computeCentroid(clusterVectors);
      }
    }

    // Early termination if no changes
    if (!changed) break;
  }

  return { assignments, centroids };
}

/**
 * Compute centroid of a set of vectors.
 */
function computeCentroid(vectors: number[][]): number[] {
  const dim = vectors[0].length;
  const centroid = new Array(dim).fill(0);

  for (const v of vectors) {
    for (let i = 0; i < dim; i++) {
      centroid[i] += v[i];
    }
  }

  for (let i = 0; i < dim; i++) {
    centroid[i] /= vectors.length;
  }

  return centroid;
}

/**
 * Calculate Euclidean distance between two vectors.
 */
function euclideanDistance(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += Math.pow(a[i] - b[i], 2);
  }
  return Math.sqrt(sum);
}

/**
 * Calculate simplified silhouette score.
 * Samples vectors for efficiency.
 */
function calculateSilhouetteScore(
  vectors: number[][],
  assignments: number[],
  sampleSize: number
): number {
  const n = vectors.length;
  const indices = Array.from({ length: n }, (_, i) => i)
    .sort(() => Math.random() - 0.5)
    .slice(0, sampleSize);

  let totalScore = 0;

  for (const i of indices) {
    const cluster = assignments[i];
    
    // Intra-cluster distance (a)
    const intraDistances = vectors
      .map((v, j) => ({ dist: euclideanDistance(vectors[i], v), idx: j }))
      .filter(({ idx }) => assignments[idx] === cluster && idx !== i)
      .map(({ dist }) => dist);
    
    const a = intraDistances.length > 0
      ? intraDistances.reduce((sum, d) => sum + d, 0) / intraDistances.length
      : 0;

    // Inter-cluster distance (b)
    const clusters = [...new Set(assignments)];
    let minB = Infinity;
    
    for (const otherCluster of clusters) {
      if (otherCluster === cluster) continue;
      
      const interDistances = vectors
        .map((v, j) => ({ dist: euclideanDistance(vectors[i], v), idx: j }))
        .filter(({ idx }) => assignments[idx] === otherCluster)
        .map(({ dist }) => dist);
      
      if (interDistances.length > 0) {
        const b = interDistances.reduce((sum, d) => sum + d, 0) / interDistances.length;
        minB = Math.min(minB, b);
      }
    }

    const b = minB === Infinity ? 0 : minB;
    const score = (b - a) / Math.max(a, b);
    totalScore += score;
  }

  return totalScore / indices.length;
}

/**
 * Generate cluster label using GPT-4o-mini.
 */
async function generateClusterLabel(
  messages: string[]
): Promise<{ id: string; label: string; description: string; descriptionPt: string }> {
  const openai = getOpenAIClient();
  if (!openai) {
    return {
      id: 'unknown_intent',
      label: 'Unknown Intent',
      description: 'OpenAI not configured',
      descriptionPt: 'OpenAI não configurado',
    };
  }

  const sample = messages.slice(0, 15).join('\n- ');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{
      role: 'user',
      content: `These are user messages from a Brazilian football management game in Portuguese. What is the common intent or topic?

Return a JSON object with exactly these keys:
- "id": short snake_case identifier (e.g., "transfer_frustration", "match_excitement")
- "label": short human-readable name in English
- "description": one sentence description in English
- "description_pt": one sentence description in Portuguese

Messages:
- ${sample}`,
    }],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });

  const content = response.choices[0].message.content;
  if (!content) {
    return {
      id: 'unknown_intent',
      label: 'Unknown Intent',
      description: 'Could not determine intent',
      descriptionPt: 'Não foi possível determinar a intenção',
    };
  }

  const parsed = JSON.parse(content);
  return {
    id: parsed.id || 'unknown_intent',
    label: parsed.label || 'Unknown Intent',
    description: parsed.description || 'Could not determine intent',
    descriptionPt: parsed.description_pt || 'Não foi possível determinar a intenção',
  };
}