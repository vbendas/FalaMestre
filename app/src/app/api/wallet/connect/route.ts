import { NextRequest, NextResponse } from 'next/server';
import { resolveIdentity } from '@/lib/clustering/identity-resolver';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, walletAddress, email } = body;
    
    // Validate inputs
    if (!userId || !walletAddress) {
      return NextResponse.json(
        { error: 'userId and walletAddress are required' },
        { status: 400 }
      );
    }
    
    // Validate wallet address format (Ethereum-compatible address)
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return NextResponse.json(
        { error: 'Invalid wallet address format' },
        { status: 400 }
      );
    }
    
    // Resolve identity and profile wallet on Chiliz Chain
    const walletProfile = await resolveIdentity(userId, walletAddress, email);
    
    if (!walletProfile) {
      return NextResponse.json(
        { error: 'Failed to profile wallet' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      walletProfile: {
        address: walletProfile.address,
        chzBalance: walletProfile.chzBalance,
        fanTokenBalances: walletProfile.fanTokenBalances,
        archetype: walletProfile.archetype,
        transactionCount: walletProfile.transactionCount,
      },
    });
  } catch (error) {
    console.error('Wallet connect error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
