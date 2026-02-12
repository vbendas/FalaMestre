/**
 * Chiliz Chain configuration for Web3 integration.
 * Dependency-free typed config to keep build stable when optional Web3 SDKs
 * are not installed in the runtime environment.
 */

export interface ChainConfig {
  id: number;
  name: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: {
    default: { http: string[] };
    public: { http: string[] };
  };
  blockExplorers: {
    default: {
      name: string;
      url: string;
    };
  };
  testnet?: boolean;
}

/**
 * Chiliz Mainnet configuration
 * Chain ID: 88888
 */
export const chilizMainnet: ChainConfig = {
  id: 88888,
  name: 'Chiliz Chain',
  nativeCurrency: {
    name: 'CHZ',
    symbol: 'CHZ',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [process.env.CHILIZ_RPC_URL || 'https://rpc.ankr.com/chiliz'],
    },
    public: {
      http: [process.env.CHILIZ_RPC_URL || 'https://rpc.ankr.com/chiliz'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Chiliz Scan',
      url: 'https://scan.chiliz.com',
    },
  },
};

/**
 * Chiliz Spicy Testnet configuration
 * Chain ID: 88882
 */
export const chilizTestnet: ChainConfig = {
  id: 88882,
  name: 'Chiliz Spicy Testnet',
  nativeCurrency: {
    name: 'CHZ',
    symbol: 'CHZ',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://spicy-rpc.chiliz.com/'],
    },
    public: {
      http: ['https://spicy-rpc.chiliz.com/'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Spicy Explorer',
      url: 'https://testnet.chiliz.com',
    },
  },
  testnet: true,
};

/**
 * CAP-20 ABI shape maintained for downstream compatibility.
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
 * Placeholder Fan Token addresses.
 */
export const FAN_TOKEN_ADDRESSES: Record<string, `0x${string}`> = {
  FLA: '0x1234567890123456789012345678901234567890' as `0x${string}`,
  PAL: '0x2345678901234567890123456789012345678901' as `0x${string}`,
  COR: '0x3456789012345678901233456789012345678901' as `0x${string}`,
  SAO: '0x4567890123456789012345678901234567890123' as `0x${string}`,
  INT: '0x5678901234567890123456789012345678901234' as `0x${string}`,
};

export function getChilizChain(): ChainConfig {
  return process.env.NODE_ENV === 'production' ? chilizMainnet : chilizTestnet;
}
