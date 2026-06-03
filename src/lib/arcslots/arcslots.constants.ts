/**
 * ArcSlots Configuration - Completely Isolated Constants
 * ⚠️ ZERO REGRESSION POLICY: These values are independent from all other modules
 * Decimals: USDC = 6, ARC rewards = 18
 */

// Immutable Spin & Game Economics
export const ARCSLOTS_CONFIG = {
  // Spin Fee (denominated in USDC, 6 decimals)
  SPIN_FEE: "0.1",
  SPIN_FEE_USDC_DECIMALS: 6,
  
  // Claim/Withdrawal Fee (percentage, 0.01 = 1%)
  CLAIM_FEE: "0.01",
  
  // Jackpot Rules
  MIN_JACKPOT: 1,
  MAX_SPINS_PER_TX: 100,
  
  // Cashback Reward Rate (10% = 0.10)
  CASHBACK_BPS: 0.10,
  
  // ARC Token Reward Decimals
  ARC_DECIMALS: 18,
} as const;

// Token Addresses (Arc Testnet)
export const ARCSLOTS_TOKENS = {
  USDC_ADDRESS: process.env.NEXT_PUBLIC_ARCSLOTS_USDC_ADDRESS || process.env.NEXT_PUBLIC_USDC_ADDRESS || "0x94B008aA00579c1307B0EF2c499aD98a8ce58e58",
  USDC_DECIMALS: 6,
  
  ARC_ADDRESS: process.env.NEXT_PUBLIC_ARCSLOTS_ARC_ADDRESS || "0x9d3A36Aa1e8C0f52cE0fcCC7baECfCe34d68D4B7",
  ARC_DECIMALS: 18,
} as const;

// Deployed on Arc Testnet (Chain ID 5042002)
export const ARCSLOTS_ADDRESS = "0x4399EbB49F4287c2A403131CDbB931EDa2611eDD";

// Treasury Address for claim fee / platform revenue
export const ARCSLOTS_TREASURY_ADDRESS = process.env.NEXT_PUBLIC_ARCSLOTS_TREASURY_ADDRESS?.trim() || process.env.NEXT_PUBLIC_TREASURY_ADDRESS?.trim() || "0x0000000000000000000000000000000000000000";

// Spin Fee in USDC (with 6 decimals)
export const SPIN_FEE_USDC = process.env.NEXT_PUBLIC_ARCSLOTS_SPIN_FEE_USDC || "100000"; // 0.1 USDC = 100000 units @ 6 decimals

// Supabase Isolated Table Names
export const ARCSLOTS_TABLES = {
  POOL: "arcslots_pool",
  SPINS: "arcslots_spins",
  DONATIONS: "arcslots_donations",
  PAYOUTS: "arcslots_payouts",
  STATS_LIVE: "arcslots_stats_live",
} as const;

// Symbols for Slot Machine (3 reels)
export const SLOT_SYMBOLS = ["🎯", "💎", "⚡", "🏆", "🔥", "🌟"] as const;
export type SlotSymbol = typeof SLOT_SYMBOLS[number];

// Reward Multipliers per Symbol Combo
export const SYMBOL_MULTIPLIERS: Record<string, number> = {
  "🎯🎯🎯": 10,
  "💎💎💎": 50,
  "⚡⚡⚡": 25,
  "🏆🏆🏆": 100,
  "🔥🔥🔥": 75,
  "🌟🌟🌟": 200,
  "🎯💎⚡": 2,
  "🏆🔥🌟": 5,
} as const;

// Network Configuration
export const ARCSLOTS_NETWORK = {
  CHAIN_ID: 5042002,
  CHAIN_NAME: "Arc Testnet",
  RPC_URL: "https://rpc.testnet.arc.network",
  EXPLORER: "https://testnet.arcscan.app",
} as const;

// Validation Regex Patterns (Isolated)
export const ARCSLOTS_VALIDATION = {
  ETH_ADDRESS: /^0x[a-fA-F0-9]{40}$/,
  TX_HASH: /^0x[a-fA-F0-9]{64}$/,
  POSITIVE_NUMBER: /^\d+(\.\d+)?$/,
} as const;
