/**
 * Wallet profiler service.
 * Reads on-chain data from Chiliz Chain to profile wallet activity.
 */

import { createPublicClient, http, formatUnits } from 'viem';
import { chilizMainnet, chilizTestnet, CAP20_ABI, FAN_TOKEN_ADDRESSES } from './chain-config';
import { WalletProfile, WalletArchetype } from '@/lib/clustering/types';

// Determine which chain to use
const targetChain = process.env.NODE_ENV === 'production' ? chilizMainnet : chilizTestnet;

// Create public client for reading chain data
const client = createPublicClient({
  chain: targetChain,
  transport: http(),
});

/**
 * Profile a wallet on Chiliz Chain.
 * Reads: CHZ balance, Fan Token balances (multicall), transaction count.
 * Classifies archetype based on on-chain data.
 * 
 * @param address - Wallet address (0x...)
 * @returns WalletProfile with balance, token holdings, and archetype
 */
export async function profileWallet(address: `0x${string}`): Promise<WalletProfile> {
  try {
    // 1. Read CHZ balance
    const chzBalanceWei = await client.getBalance({ address });
    const chzBalance = formatUnits(chzBalanceWei, 18);
    
    // 2. Read all Fan Token balances using multicall
    const fanTokenCalls = Object.entries(FAN_TOKEN_ADDRESSES).map(([symbol, tokenAddr]) => ({
      address: tokenAddr,
      abi: CAP20_ABI,
      functionName: 'balanceOf' as const,
      args: [address],
    }));
    
    let fanTokenBalances: Record<string, number> = {};
    
    if (fanTokenCalls.length > 0) {
      try {
        const results = await client.multicall({ contracts: fanTokenCalls });
        
        Object.keys(FAN_TOKEN_ADDRESSES).forEach((symbol, index) => {
          const result = results[index];
          if (result.status === 'success' && result.result) {
            // CAP-20 tokens have 0 decimals, so result is the actual count
            fanTokenBalances[symbol] = Number(result.result);
          } else {
            fanTokenBalances[symbol] = 0;
          }
        });
      } catch (error) {
        console.error('Error reading Fan Token balances:', error);
        // Initialize with zeros on error
        Object.keys(FAN_TOKEN_ADDRESSES).forEach(symbol => {
          fanTokenBalances[symbol] = 0;
        });
      }
    }
    
    // 3. Get transaction count (proxy for activity level)
    const txCount = await client.getTransactionCount({ address });
    
    // 4. Classify wallet archetype
    const totalFanTokens = Object.values(fanTokenBalances).reduce((a, b) => a + b, 0);
    const archetype = classifyWalletArchetype(chzBalanceWei, totalFanTokens, txCount);
    
    return {
      address,
      chzBalance,
      fanTokenBalances,
      transactionCount: Number(txCount),
      archetype,
    };
  } catch (error) {
    console.error('Error profiling wallet:', error);
    // Return minimal profile on error
    return {
      address,
      chzBalance: '0',
      fanTokenBalances: {},
      transactionCount: 0,
      archetype: 'new_wallet',
    };
  }
}

/**
 * Classify wallet into archetype based on on-chain data.
 * 
 * @param chzBalanceWei - CHZ balance in wei
 * @param totalFanTokens - Total Fan Token count across all teams
 * @param txCount - Transaction count
 * @returns WalletArchetype
 */
function classifyWalletArchetype(
  chzBalanceWei: bigint,
  totalFanTokens: number,
  txCount: number
): WalletArchetype {
  const chzAmount = Number(formatUnits(chzBalanceWei, 18));
  const txCountNum = txCount;
  
  // Classification rules
  if (txCountNum === 0) {
    return 'new_wallet';
  }
  
  if (chzAmount > 10000) {
    return 'whale';
  }
  
  if (totalFanTokens > 0 && txCountNum < 20) {
    return 'fan_token_holder';
  }
  
  if (txCountNum > 50) {
    return 'defi_active';
  }
  
  if (chzAmount > 0) {
    return 'casual_holder';
  }
  
  return 'new_wallet';
}

/**
 * Check if a wallet holds any Fan Tokens.
 * Quick check for token-gated features.
 * 
 * @param address - Wallet address
 * @returns True if wallet holds any Fan Tokens
 */
export async function hasFanTokens(address: `0x${string}`): Promise<boolean> {
  try {
    const profile = await profileWallet(address);
    const totalTokens = Object.values(profile.fanTokenBalances).reduce((a, b) => a + b, 0);
    return totalTokens > 0;
  } catch {
    return false;
  }
}

/**
 * Get specific Fan Token balance for a wallet.
 * 
 * @param address - Wallet address
 * @param symbol - Fan Token symbol (e.g., 'FLA', 'PAL')
 * @returns Token balance (0 if not found)
 */
export async function getFanTokenBalance(
  address: `0x${string}`,
  symbol: string
): Promise<number> {
  const tokenAddr = FAN_TOKEN_ADDRESSES[symbol];
  if (!tokenAddr) {
    return 0;
  }
  
  try {
    const balance = await client.readContract({
      address: tokenAddr,
      abi: CAP20_ABI,
      functionName: 'balanceOf',
      args: [address],
    });
    
    return Number(balance);
  } catch {
    return 0;
  }
}