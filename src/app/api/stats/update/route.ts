import { NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const arcTestnet = {
  id: 5042002,
  name: 'Arc Testnet',
  network: 'arc-testnet',
  nativeCurrency: { decimals: 18, name: 'USDC', symbol: 'USDC' },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.network'] },
    public: { http: ['https://rpc.testnet.arc.network'] },
  },
};

const publicClient = createPublicClient({
  chain: arcTestnet,
  transport: http()
});

export async function POST(req: Request) {
  try {
    const { txHash, walletAddress, usdVolume } = await req.json();

    if (!txHash || !walletAddress || usdVolume === undefined) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const walletLower = walletAddress.toLowerCase();

    // 1. Verify transaction on-chain
    let receipt;
    try {
      receipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
    } catch (err) {
      console.error("Payment verification failed on-chain:", err);
      return NextResponse.json({ error: 'Transaction not found or unverified' }, { status: 403 });
    }

    if (receipt.status !== 'success') {
      return NextResponse.json({ error: 'Transaction reverted on-chain' }, { status: 403 });
    }

    // Verify sender
    if (receipt.from.toLowerCase() !== walletLower) {
      return NextResponse.json({ error: 'Transaction sender mismatch' }, { status: 403 });
    }

    // 2. Verified. Update user_stats in DB using supabaseAdmin
    const pointsEarned = Number(usdVolume) / 10;
    const { data: existingStats } = await supabaseAdmin
      .from('user_stats')
      .select('*')
      .eq('wallet', walletLower);

    const currentStats = existingStats && existingStats.length > 0 ? existingStats[0] : null;

    let dbError;
    if (currentStats) {
      const newVolume = Number(currentStats.total_volume || 0) + Number(usdVolume);
      const newPoints = Number(currentStats.points || 0) + pointsEarned;
      const { error } = await supabaseAdmin
        .from('user_stats')
        .update({
          total_volume: newVolume,
          points: newPoints
        })
        .eq('wallet', walletLower);
      dbError = error;
    } else {
      const { error } = await supabaseAdmin
        .from('user_stats')
        .insert({
          wallet: walletLower,
          total_volume: Number(usdVolume),
          points: pointsEarned
        });
      dbError = error;
    }

    if (dbError) {
      console.error("Database secure stats update failed:", dbError);
      return NextResponse.json({ error: 'Database write failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("API /stats/update error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
