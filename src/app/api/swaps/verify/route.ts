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
    const { txHash, swapData } = await req.json();

    if (!txHash || !swapData) {
      return NextResponse.json({ error: 'Missing required payload parameters' }, { status: 400 });
    }

    // 1. Verify the transaction on the Arc Testnet Blockchain
    let receipt;
    try {
      receipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
    } catch (err) {
      console.error("Blockchain verification failed:", err);
      return NextResponse.json({ error: 'Transaction not found or unverified' }, { status: 403 });
    }

    if (receipt.status !== 'success') {
      return NextResponse.json({ error: 'Transaction reverted on-chain' }, { status: 403 });
    }

    // 2. Transaction is confirmed. We can securely insert using Service Role Key
    const { error: dbError } = await supabaseAdmin.from('token_swaps').insert(swapData);

    if (dbError) {
      console.error("Database secure insert failed:", dbError);
      return NextResponse.json({ error: 'Database write failed' }, { status: 500 });
    }

    // 3. Securely update user volume and points (10 USDC Volume = 1 ARCL Point)
    try {
      const walletLower = swapData.user_address?.toLowerCase();
      if (walletLower) {
        const swapUsdcAmount = Number(swapData.usdc_amount || 0);
        const pointsEarned = swapUsdcAmount / 10;

        const { data: existingStats } = await supabaseAdmin
          .from('user_stats')
          .select('*')
          .eq('wallet', walletLower);

        const currentStats = existingStats && existingStats.length > 0 ? existingStats[0] : null;

        if (currentStats) {
          const newVolume = Number(currentStats.total_volume || 0) + swapUsdcAmount;
          const newPoints = Number(currentStats.points || 0) + pointsEarned;
          await supabaseAdmin
            .from('user_stats')
            .update({
              total_volume: newVolume,
              points: newPoints
            })
            .eq('wallet', walletLower);
        } else {
          await supabaseAdmin
            .from('user_stats')
            .insert({
              wallet: walletLower,
              total_volume: swapUsdcAmount,
              points: pointsEarned
            });
        }
      }
    } catch (statsErr) {
      console.error("Failed to update user stats in verification API:", statsErr);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("API /swaps/verify error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
