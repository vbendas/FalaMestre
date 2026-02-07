'use client';

/**
 * Wallet Provider Component
 * 
 * Provides two wallet connection paths:
 * 1. Privy - Invisible embedded wallet creation (for mainstream users)
 * 2. WalletConnect - External wallet connection (for existing crypto users)
 * 
 * Both configured for Chiliz Chain (mainnet or testnet based on environment).
 */

import React, { createContext, useContext, useState, useCallback } from 'react';
import { PrivyProvider, usePrivy, useWallets } from '@privy-io/react-auth';
import { createConfig, http, useAccount, useConnect, useDisconnect, useBalance, WagmiProvider } from 'wagmi';
import { walletConnect, injected } from 'wagmi/connectors';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { formatUnits } from 'viem';
import { chilizMainnet, chilizTestnet } from './chain-config';

// Determine which chain to use
const targetChain = process.env.NODE_ENV === 'production' ? chilizMainnet : chilizTestnet;

// Wagmi configuration
const wagmiConfig = createConfig({
  chains: [targetChain] as const,
  connectors: [
    walletConnect({ 
      projectId: process.env.NEXT_PUBLIC_WC_PROJECT_ID || '',
      metadata: {
        name: 'Fala Mestre!',
        description: 'AI-powered conversational football management game',
        url: typeof window !== 'undefined' ? window.location.origin : '',
        icons: [],
      },
    }),
    injected(),
  ],
  transports: {
    [chilizMainnet.id]: http(),
    [chilizTestnet.id]: http(),
  },
});

// Query client for React Query
const queryClient = new QueryClient();

// Wallet context
interface WalletContextType {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  walletType: 'privy' | 'external' | null;
  chzBalance: string | null;
  connectWallet: () => void;
  disconnectWallet: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

/**
 * Inner provider that uses both Privy and Wagmi hooks
 */
function WalletProviderInner({ children }: { children: React.ReactNode }) {
  // Privy hooks
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { wallets: privyWallets } = useWallets();
  
  // Wagmi hooks
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();
  const { connect, connectors, isPending: isWagmiConnecting } = useConnect();
  const { disconnect: wagmiDisconnect } = useDisconnect();
  const { data: balanceData } = useBalance({
    address: wagmiAddress,
  });
  
  // Determine which wallet is active
  const privyWallet = privyWallets[0];
  const privyAddress = privyWallet?.address;
  
  // State
  const [isConnecting, setIsConnecting] = useState(false);
  
  // Active wallet info
  const isConnected = wagmiConnected || !!privyAddress;
  const address = wagmiAddress || privyAddress || null;
  const walletType: 'privy' | 'external' | null = privyAddress 
    ? 'privy' 
    : wagmiConnected 
      ? 'external' 
      : null;
  
  // Connect function
  const connectWallet = useCallback(() => {
    setIsConnecting(true);
    
    // Try WalletConnect first (external wallets)
    const walletConnectConnector = connectors.find(c => c.id === 'walletConnect');
    if (walletConnectConnector) {
      connect({ connector: walletConnectConnector });
    } else {
      // Fall back to Privy
      login();
    }
    
    setTimeout(() => setIsConnecting(false), 1000);
  }, [connect, connectors, login]);
  
  // Disconnect function
  const disconnectWallet = useCallback(() => {
    if (wagmiConnected) {
      wagmiDisconnect();
    }
    if (authenticated) {
      logout();
    }
  }, [wagmiConnected, wagmiDisconnect, authenticated, logout]);
  
  const contextValue: WalletContextType = {
    address,
    isConnected,
    isConnecting: isConnecting || isWagmiConnecting,
    walletType,
    chzBalance: balanceData ? formatUnits(balanceData.value, balanceData.decimals) : null,
    connectWallet,
    disconnectWallet,
  };
  
  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  );
}

/**
 * Main Wallet Provider
 * Wraps the app with PrivyProvider, WagmiProvider, and QueryClientProvider
 */
export function Web3Provider({ children }: { children: React.ReactNode }) {
  const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  
  // If no Privy app ID, just render children (wallet features disabled)
  if (!privyAppId) {
    console.warn('NEXT_PUBLIC_PRIVY_APP_ID not set, wallet features disabled');
    return <>{children}</>;
  }
  
  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        appearance: { 
          theme: 'dark',
          accentColor: '#E11D48', // Rose-600 for brand color
        },
        defaultChain: targetChain,
        supportedChains: [targetChain],
        loginMethods: ['email', 'google', 'twitter', 'discord'],
      }}
    >
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          <WalletProviderInner>
            {children}
          </WalletProviderInner>
        </QueryClientProvider>
      </WagmiProvider>
    </PrivyProvider>
  );
}

/**
 * Hook to use wallet context
 */
export function useWalletConnection() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWalletConnection must be used within a Web3Provider');
  }
  return context;
}