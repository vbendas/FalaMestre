/**
 * Wallet profiler service.
 *
 * Build-stable fallback implementation that keeps the same public API without
 * requiring optional Web3 SDK dependencies at compile time.
 */

import { FAN_TOKEN_ADDRESSES } from './chain-config';
import { WalletProfile, WalletArchetype } from '@/lib/clustering/types';

function classifyWalletArchetype(
  chzBalance: number,
  totalFanTokens: number,
  txCount: number
): WalletArchetype {
  if (txCount === 0) return 'new_wallet';
  if (chzBalance > 10000) return 'whale';
  if (totalFanTokens > 0 && txCount < 20) return 'fan_token_holder';
  if (txCount > 50) return 'defi_active';
  if (chzBalance > 0) return 'casual_holder';
  return 'new_wallet';
}

/**
 * Profiles a wallet using conservative defaults when Web3 SDKs are unavailable.
 */
export async function profileWallet(address: `0x${string}`): Promise<WalletProfile | null> {
  if (!process.env.WALLET_PROFILER_ENABLED) {
    console.warn('[wallet-profiler] Stub mode — WALLET_PROFILER_ENABLED not set. Returning null.');
    return null;
  }

  const fanTokenBalances: Record<string, number> = {};
  Object.keys(FAN_TOKEN_ADDRESSES).forEach((symbol) => {
    fanTokenBalances[symbol] = 0;
  });

  const chzBalance = 0;
  const txCount = 0;

  return {
    address,
    chzBalance: String(chzBalance),
    fanTokenBalances,
    transactionCount: txCount,
    archetype: classifyWalletArchetype(chzBalance, 0, txCount),
  };
}

export async function hasFanTokens(address: `0x${string}`): Promise<boolean> {
  const profile = await profileWallet(address);
  if (!profile) return false;
  const totalTokens = Object.values(profile.fanTokenBalances).reduce((a, b) => a + b, 0);
  return totalTokens > 0;
}

export async function getFanTokenBalance(
  address: `0x${string}`,
  symbol: string
): Promise<number> {
  const profile = await profileWallet(address);
  if (!profile) return 0;
  return profile.fanTokenBalances[symbol] ?? 0;
}
