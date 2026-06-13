import { NextResponse } from 'next/server';
import { createPublicClient, http } from 'viem';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const arcTestnet = {
  id: 4156,
  name: 'Arc Testnet',
  network: 'arc-testnet',
  nativeCurrency: { decimals: 18, name: 'ARC', symbol: 'ARC' },
  rpcUrls: {
    default: { http: ['https://rpc-testnet.arcscan.app'] },
    public: { http: ['https://rpc-testnet.arcscan.app'] },
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

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("API /swaps/verify error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
