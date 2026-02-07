/**
 * Chiliz Chain configuration for Web3 integration.
 * Supports both mainnet (Chain ID 88888) and testnet Spicy (Chain ID 88882).
 */

import { defineChain } from 'viem';

/**
 * Chiliz Mainnet configuration
 * Chain ID: 88888
 * RPC: Ankr (default) or custom via env
 */
export const chilizMainnet = defineChain({
  id: 88888,
  name: 'Chiliz Chain',
  nativeCurrency: { 
    name: 'CHZ', 
    symbol: 'CHZ', 
    decimals: 18 
  },
  rpcUrls: {
    default: { 
      http: [process.env.CHILIZ_RPC_URL || 'https://rpc.ankr.com/chiliz'] 
    },
    public: { 
      http: [process.env.CHILIZ_RPC_URL || 'https://rpc.ankr.com/chiliz'] 
    },
  },
  blockExplorers: {
    default: { 
      name: 'Chiliz Scan', 
      url: 'https://scan.chiliz.com' 
    },
  },
});

/**
 * Chiliz Spicy Testnet configuration
 * Chain ID: 88882
 * For development and testing
 */
export const chilizTestnet = defineChain({
  id: 88882,
  name: 'Chiliz Spicy Testnet',
  nativeCurrency: { 
    name: 'CHZ', 
    symbol: 'CHZ', 
    decimals: 18 
  },
  rpcUrls: {
    default: { 
      http: ['https://spicy-rpc.chiliz.com/'] 
    },
    public: { 
      http: ['https://spicy-rpc.chiliz.com/'] 
    },
  },
  blockExplorers: {
    default: { 
      name: 'Spicy Explorer', 
      url: 'https://testnet.chiliz.com' 
    },
  },
  testnet: true,
});

/**
 * CAP-20 (Chiliz Application Protocol) ABI
 * Fan Tokens use CAP-20 standard (identical to ERC-20 but with 0 decimals)
 */
export const CAP20_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

/**
 * Brazilian team Fan Token addresses on Chiliz Chain
 * Source: https://fanx.gitbook.io/fanx-docs/contract/tokens-in-fanx
 * 
 * NOTE: These are placeholder addresses. Replace with actual addresses from FanX docs.
 */
export const FAN_TOKEN_ADDRESSES: Record<string, `0x${string}`> = {
  // Flamengo
  'FLA': '0x1234567890123456789012345678901234567890' as `0x${string}`,
  // Palmeiras  
  'PAL': '0x2345678901234567890123456789012345678901' as `0x${string}`,
  // Corinthians
  'COR': '0x3456789012345678901234567890123456789012' as `0x${string}`,
  // São Paulo
  'SAO': '0x4567890123456789012345678901234567890123' as `0x${string}`,
  // Internacional
  'INT': '0x5678901234567890123456789012345678901234' as `0x${string}`,
  // Add more teams as needed
};

/**
 * Get the appropriate chain configuration based on environment
 */
export function getChilizChain() {
  return process.env.NODE_ENV === 'production' 
    ? chilizMainnet 
    : chilizTestnet;
}