// @ts-nocheck - A-Frame doesn't have complete TypeScript definitions
'use client';

import React from 'react';

interface VRErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface VRErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class VRErrorBoundary extends React.Component<VRErrorBoundaryProps, VRErrorBoundaryState> {
  constructor(props: VRErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): VRErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[VR Error Boundary] Caught error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <a-entity>
          <a-box position="0 1 -5" color="#FF0000" width={2} height={2} depth={0.1}>
            <a-text 
              value="VR Error" 
              position="0 0.3 0.1" 
              align="center" 
              width={4}
              color="#FFFFFF"
            />
            <a-text 
              value="Please refresh the page" 
              position="0 0 0.1" 
              align="center" 
              width={3}
              color="#FFFFFF"
            />
          </a-box>
        </a-entity>
      );
    }

    return this.props.children;
  }
}
