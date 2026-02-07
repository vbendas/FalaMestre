/**
 * Identity resolution service.
 * Links wallet addresses to game user IDs and email hashes.
 * Creates the deterministic identity chain: wallet ↔ game_id ↔ email_hash
 */

import crypto from 'crypto';
import { db } from '@/db';
import { userProfiles } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { profileWallet } from '@/lib/web3/wallet-profiler';
import { WalletProfile } from '@/lib/clustering/types';

/**
 * Hash a PII string (email or phone) with SHA-256.
 * Lowercases and trims before hashing to match Google/Facebook format.
 * 
 * @param value - String to hash
 * @returns SHA-256 hash hex string
 */
export function hashPII(value: string): string {
  const normalized = value.toLowerCase().trim();
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * Resolve identity by linking a wallet address to a game user ID.
 * 
 * This creates the critical link in the identity chain:
 * wallet_address ↔ game_user_id ↔ email_hash
 * 
 * Enables:
 * - On-chain behavior → game analytics
 * - Game behavior → wallet profiling
 * - Unified profile → ad platform activation
 * 
 * @param userId - Game internal user ID
 * @param walletAddress - Chiliz wallet address (0x...)
 * @param email - Optional email (if available from auth)
 * @returns The wallet profile, or null on error
 */
export async function resolveIdentity(
  userId: string,
  walletAddress: string,
  email?: string
): Promise<WalletProfile | null> {
  // Validate wallet address format
  if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    console.error('Invalid wallet address format:', walletAddress);
    return null;
  }

  try {
    // 1. Hash email if provided
    const emailHash = email ? hashPII(email) : null;

    // 2. Update user_profiles with wallet info
    await db.insert(userProfiles)
      .values({
        userId,
        walletAddress: walletAddress.toLowerCase(),
        emailHash,
        walletConnectedAt: new Date(),
        updatedAt: new Date(),
        // Default values for required fields
        totalMatches: 0,
        totalPoints: 0,
        sessionsCount: 0,
        avgSessionDurationSec: 0,
        daysActive: 0,
        matchWinRate: 0,
        transfersMade: 0,
        aggressivenessScore: 50,
        spendingScore: 50,
        socialScore: 50,
        competitivenessScore: 50,
        softTrainingScore: 0,
        softTrainingPhase: 0,
        purchaseIntentScore: 0,
        churnRiskScore: 0.5,
        ltvEstimate: 0,
        consentMarketing: false,
        consentAnalytics: true,
        consentDataExport: false,
        createdAt: new Date(),
      })
      .onConflictDoUpdate({
        target: userProfiles.userId,
        set: {
          walletAddress: walletAddress.toLowerCase(),
          emailHash: emailHash ?? undefined,
          walletConnectedAt: new Date(),
          updatedAt: new Date(),
        },
      });

    // 3. Profile the wallet on-chain
    const walletProfile = await profileWallet(walletAddress as `0x${string}`);

    // 4. Update user_profiles with wallet archetype and balances
    await db.update(userProfiles)
      .set({
        walletArchetype: walletProfile.archetype,
        fanTokenBalance: walletProfile.fanTokenBalances,
        updatedAt: new Date(),
      })
      .where(eq(userProfiles.userId, userId));

    return walletProfile;
  } catch (error) {
    console.error('Error resolving identity:', error);
    return null;
  }
}

/**
 * Get the wallet address for a user ID.
 * 
 * @param userId - Game user ID
 * @returns Wallet address or null if not connected
 */
export async function getUserWallet(userId: string): Promise<string | null> {
  try {
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, userId),
      columns: {
        walletAddress: true,
      },
    });

    return profile?.walletAddress || null;
  } catch {
    return null;
  }
}

/**
 * Check if a user has connected a wallet.
 * 
 * @param userId - Game user ID
 * @returns True if wallet is connected
 */
export async function hasConnectedWallet(userId: string): Promise<boolean> {
  const wallet = await getUserWallet(userId);
  return wallet !== null;
}

/**
 * Get identity resolution status for a user.
 * Returns full identity chain info if available.
 * 
 * @param userId - Game user ID
 * @returns Identity info or null
 */
export async function getIdentityInfo(userId: string): Promise<{
  userId: string;
  walletAddress: string | null;
  emailHash: string | null;
  walletArchetype: string | null;
  walletConnectedAt: Date | null;
} | null> {
  try {
    const profile = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.userId, userId),
      columns: {
        userId: true,
        walletAddress: true,
        emailHash: true,
        walletArchetype: true,
        walletConnectedAt: true,
      },
    });

    if (!profile) {
      return null;
    }

    return {
      userId: profile.userId,
      walletAddress: profile.walletAddress,
      emailHash: profile.emailHash,
      walletArchetype: profile.walletArchetype,
      walletConnectedAt: profile.walletConnectedAt,
    };
  } catch {
    return null;
  }
}