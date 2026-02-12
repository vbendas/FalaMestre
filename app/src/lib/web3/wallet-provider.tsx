'use client';

/**
 * Lightweight wallet provider fallback.
 *
 * This keeps a stable app-level interface without requiring optional Web3
 * runtime dependencies. It can be replaced by a full integration provider
 * when those dependencies are intentionally enabled.
 */

import React, { createContext, useContext, useState, useCallback } from 'react';

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

export function Web3Provider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const connectWallet = useCallback(() => {
    setIsConnecting(true);
    // Placeholder flow for environments without wallet SDKs.
    setTimeout(() => {
      setAddress(null);
      setIsConnecting(false);
    }, 300);
  }, []);

  const disconnectWallet = useCallback(() => {
    setAddress(null);
    setIsConnecting(false);
  }, []);

  const contextValue: WalletContextType = {
    address,
    isConnected: !!address,
    isConnecting,
    walletType: null,
    chzBalance: null,
    connectWallet,
    disconnectWallet,
  };

  return <WalletContext.Provider value={contextValue}>{children}</WalletContext.Provider>;
}

export function useWalletConnection() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWalletConnection must be used within a Web3Provider');
  }
  return context;
}
