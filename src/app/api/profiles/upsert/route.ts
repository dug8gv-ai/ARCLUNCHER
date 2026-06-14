import { NextResponse } from 'next/server';
import { verifyMessage } from 'viem';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const ADMIN_WALLET = '0x218b09A7d9FF6D69082Ac605bb27029bC321B5C3'.toLowerCase();

export async function POST(req: Request) {
  try {
    const { wallet, name, avatar, twitter, discord, is_affiliate, targetWallet, message, signature } = await req.json();

    if (!wallet || !message || !signature) {
      return NextResponse.json({ error: 'Missing signature verification parameters' }, { status: 400 });
    }

    const walletLower = wallet.toLowerCase();

    // 1. Verify that the wallet owner signed the message
    let isValid = false;
    try {
      isValid = await verifyMessage({
        address: walletLower as `0x${string}`,
        message,
        signature,
      });
    } catch (err: any) {
      console.error("Signature verification failed:", err);
      return NextResponse.json({ error: 'Invalid signature verification' }, { status: 403 });
    }

    if (!isValid) {
      return NextResponse.json({ error: 'Signature verification failed' }, { status: 403 });
    }

    // 2. Resolve target profile address (support admin editing other profiles)
    let finalTargetWallet = walletLower;
    if (targetWallet && targetWallet.toLowerCase() !== walletLower) {
      // Editing another profile is strictly reserved for the ADMIN wallet
      if (walletLower !== ADMIN_WALLET) {
        return NextResponse.json({ error: 'Unauthorized profile access' }, { status: 403 });
      }
      finalTargetWallet = targetWallet.toLowerCase();
    }

    // 3. Prepare database payload
    const profilePayload: any = {
      wallet: finalTargetWallet
    };

    if (name !== undefined) profilePayload.name = name;
    if (avatar !== undefined) profilePayload.avatar = avatar;
    if (twitter !== undefined) profilePayload.twitter = twitter;
    if (discord !== undefined) profilePayload.discord = discord;

    // 4. Only the ADMIN can modify affiliate status
    if (is_affiliate !== undefined) {
      if (walletLower === ADMIN_WALLET) {
        profilePayload.is_affiliate = is_affiliate;
      }
    }

    // 5. Perform upsert securely using supabaseAdmin
    const { data: existingProfile } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('wallet', finalTargetWallet);

    let dbError;
    if (existingProfile && existingProfile.length > 0) {
      const { error } = await supabaseAdmin
        .from('profiles')
        .update(profilePayload)
        .eq('wallet', finalTargetWallet);
      dbError = error;
    } else {
      // Ensure default fallback values for new profiles
      if (!profilePayload.name) profilePayload.name = 'Anonymous';
      if (!profilePayload.avatar) profilePayload.avatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${finalTargetWallet}`;
      
      const { error } = await supabaseAdmin
        .from('profiles')
        .insert(profilePayload);
      dbError = error;
    }

    if (dbError) {
      console.error("Database secure profile upsert failed:", dbError);
      return NextResponse.json({ error: 'Database write failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("API /profiles/upsert error:", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
