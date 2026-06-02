'use server';

/**
 * ArcSlots Server Functions - Completely Isolated from other modules
 * All database operations target dedicated arcslots_* tables only
 * Input validation using Zod schemas
 */

import { supabase } from '@/lib/supabase';
import { 
  ARCSLOTS_CONFIG, 
  ARCSLOTS_TABLES, 
  ARCSLOTS_VALIDATION,
  SLOT_SYMBOLS,
  SYMBOL_MULTIPLIERS,
} from './arcslots.constants';

// Zod-inspired validation (minimal version to avoid new dependency)
const validateAddress = (addr: string): boolean => {
  return ARCSLOTS_VALIDATION.ETH_ADDRESS.test(addr);
};

const validateTxHash = (hash: string): boolean => {
  return ARCSLOTS_VALIDATION.TX_HASH.test(hash);
};

/**
 * Get current pool state
 */
export async function getPool(userAddress: string) {
  if (!validateAddress(userAddress)) {
    throw new Error('Invalid wallet address format');
  }

  try {
    const { data, error } = await supabase
      .from(ARCSLOTS_TABLES.POOL)
      .select('*')
      .eq('user_address', userAddress.toLowerCase())
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    // Return defaults if no pool exists
    return data || {
      user_address: userAddress.toLowerCase(),
      balance_usdc: 0,
      balance_arc: 0,
      total_spins: 0,
      total_won: 0,
      created_at: new Date().toISOString(),
    };
  } catch (err: any) {
    console.error('getPool error:', err);
    throw new Error(`Failed to fetch pool: ${err.message}`);
  }
}

/**
 * Get global statistics across all ArcSlots players
 */
export async function getGlobalStats() {
  try {
    const { data: poolData, error: poolError } = await supabase
      .from(ARCSLOTS_TABLES.POOL)
      .select('total_spins, total_won');

    if (poolError) throw poolError;

    const totalSpins = (poolData || []).reduce((acc, p) => acc + (p.total_spins || 0), 0);
    const totalWon = (poolData || []).reduce((acc, p) => acc + (p.total_won || 0), 0);

    const { data: spinData, error: spinError } = await supabase
      .from(ARCSLOTS_TABLES.SPINS)
      .select('count');

    if (spinError) throw spinError;

    return {
      total_spins: totalSpins,
      total_won: totalWon,
      active_players: poolData?.length || 0,
      last_updated: new Date().toISOString(),
    };
  } catch (err: any) {
    console.error('getGlobalStats error:', err);
    throw new Error(`Failed to fetch global stats: ${err.message}`);
  }
}

/**
 * Get treasury/jackpot information
 */
export async function getTreasuryInfo() {
  try {
    const { data, error } = await supabase
      .from(ARCSLOTS_TABLES.POOL)
      .select('balance_usdc, balance_arc')
      .eq('user_address', 'treasury')
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data || {
      balance_usdc: 0,
      balance_arc: 0,
      status: 'active',
    };
  } catch (err: any) {
    console.error('getTreasuryInfo error:', err);
    throw new Error(`Failed to fetch treasury info: ${err.message}`);
  }
}

/**
 * Record a donation to the pool
 */
export async function confirmDonation(
  userAddress: string,
  amountUsdc: string,
  txHash: string
) {
  if (!validateAddress(userAddress)) {
    throw new Error('Invalid wallet address format');
  }
  if (!validateTxHash(txHash)) {
    throw new Error('Invalid transaction hash format');
  }

  try {
    const { data, error } = await supabase
      .from(ARCSLOTS_TABLES.DONATIONS)
      .insert([
        {
          user_address: userAddress.toLowerCase(),
          amount_usdc: parseFloat(amountUsdc),
          tx_hash: txHash,
          status: 'confirmed',
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      donation_id: data.id,
      amount_usdc: data.amount_usdc,
      timestamp: data.created_at,
    };
  } catch (err: any) {
    console.error('confirmDonation error:', err);
    throw new Error(`Failed to confirm donation: ${err.message}`);
  }
}

/**
 * Record a spin transaction
 */
export async function confirmSpin(
  userAddress: string,
  numSpins: number,
  txHash: string,
  symbols: string[] // ["🎯", "💎", "⚡"]
) {
  if (!validateAddress(userAddress)) {
    throw new Error('Invalid wallet address format');
  }
  if (!validateTxHash(txHash)) {
    throw new Error('Invalid transaction hash format');
  }
  if (numSpins < 1 || numSpins > ARCSLOTS_CONFIG.MAX_SPINS_PER_TX) {
    throw new Error(`Spins must be between 1 and ${ARCSLOTS_CONFIG.MAX_SPINS_PER_TX}`);
  }

  try {
    // Determine win multiplier based on symbols
    const symbolCombo = symbols.join('');
    const multiplier = SYMBOL_MULTIPLIERS[symbolCombo as keyof typeof SYMBOL_MULTIPLIERS] || 1;
    const arcReward = multiplier * numSpins;

    const { data, error } = await supabase
      .from(ARCSLOTS_TABLES.SPINS)
      .insert([
        {
          user_address: userAddress.toLowerCase(),
          num_spins: numSpins,
          symbols: symbols,
          multiplier,
          arc_reward: arcReward,
          tx_hash: txHash,
          status: 'confirmed',
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) throw error;

    // Update user pool record
    const pool = await getPool(userAddress);
    const { error: updateError } = await supabase
      .from(ARCSLOTS_TABLES.POOL)
      .upsert(
        {
          user_address: userAddress.toLowerCase(),
          balance_arc: pool.balance_arc + arcReward,
          total_spins: pool.total_spins + numSpins,
          total_won: pool.total_won + arcReward,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_address' }
      );

    if (updateError) throw updateError;

    return {
      success: true,
      spin_id: data.id,
      symbols,
      multiplier,
      arc_reward: arcReward,
      timestamp: data.created_at,
    };
  } catch (err: any) {
    console.error('confirmSpin error:', err);
    throw new Error(`Failed to confirm spin: ${err.message}`);
  }
}

/**
 * Get pending payouts for a user
 */
export async function getPendingPayouts(userAddress: string) {
  if (!validateAddress(userAddress)) {
    throw new Error('Invalid wallet address format');
  }

  try {
    const { data, error } = await supabase
      .from(ARCSLOTS_TABLES.PAYOUTS)
      .select('*')
      .eq('user_address', userAddress.toLowerCase())
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map((payout) => ({
      payout_id: payout.id,
      amount_arc: payout.amount_arc,
      claimed: false,
      created_at: payout.created_at,
    }));
  } catch (err: any) {
    console.error('getPendingPayouts error:', err);
    throw new Error(`Failed to fetch pending payouts: ${err.message}`);
  }
}

/**
 * Claim jackpot or pending rewards
 */
export async function claimJackpot(
  userAddress: string,
  payoutId: string,
  txHash: string
) {
  if (!validateAddress(userAddress)) {
    throw new Error('Invalid wallet address format');
  }
  if (!validateTxHash(txHash)) {
    throw new Error('Invalid transaction hash format');
  }

  try {
    // Verify ownership
    const { data: payout, error: payoutError } = await supabase
      .from(ARCSLOTS_TABLES.PAYOUTS)
      .select('*')
      .eq('id', payoutId)
      .eq('user_address', userAddress.toLowerCase())
      .single();

    if (payoutError || !payout) {
      throw new Error('Payout not found or invalid user');
    }

    // Apply claim fee
    const claimFeeAmount = payout.amount_arc * parseFloat(ARCSLOTS_CONFIG.CLAIM_FEE);
    const netAmount = payout.amount_arc - claimFeeAmount;

    // Mark as claimed
    const { error: updateError } = await supabase
      .from(ARCSLOTS_TABLES.PAYOUTS)
      .update({
        status: 'claimed',
        tx_hash_claim: txHash,
        claimed_at: new Date().toISOString(),
        net_amount: netAmount,
      })
      .eq('id', payoutId);

    if (updateError) throw updateError;

    return {
      success: true,
      payout_id: payoutId,
      gross_amount: payout.amount_arc,
      claim_fee: claimFeeAmount,
      net_amount: netAmount,
      tx_hash: txHash,
      timestamp: new Date().toISOString(),
    };
  } catch (err: any) {
    console.error('claimJackpot error:', err);
    throw new Error(`Failed to claim jackpot: ${err.message}`);
  }
}

/**
 * Get live stats for real-time updates
 */
export async function getLiveStats() {
  try {
    const { data, error } = await supabase
      .from(ARCSLOTS_TABLES.STATS_LIVE)
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return data || {
      total_volume: 0,
      active_spins: 0,
      last_big_win: 0,
      updated_at: new Date().toISOString(),
    };
  } catch (err: any) {
    console.error('getLiveStats error:', err);
    throw new Error(`Failed to fetch live stats: ${err.message}`);
  }
}
