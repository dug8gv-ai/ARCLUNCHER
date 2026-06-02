# 🎰 ArcSlots Architecture Diagram

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     ArcOmni Pro Main Dashboard                   │
│                      (src/app/page.tsx)                          │
│                   [UNCHANGED - ZERO REGRESSION]                  │
└──────────────────────┬──────────────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
        ▼                             ▼
   Existing Features            ArcSlots Feature
   ────────────────             ──────────────
   - Token Swap                - Slot Machine Game
   - Prediction Market         - Spin for ARC rewards
   - Affiliates                - Real-time stats
   - Leaderboard               - Claim rewards
   [UNTOUCHED]                 [ISOLATED MODULE]


┌────────────────────────────────────────────────────────────────────┐
│                    ArcSlots Isolated Module                        │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │                  /slots Route (App Router)                   │ │
│  │                   src/app/slots/page.tsx                     │ │
│  │                                                              │ │
│  │  ┌────────────────┬──────────────┬──────────────────────┐   │ │
│  │  │                │              │                      │   │ │
│  │  ▼                ▼              ▼                      ▼   │ │
│  │ Reel          Machine         Pool        Stats          │ │
│  │ Animations    Controller      Display     Bar            │ │
│  │ (Framer)      (Web3)          (Query)     (Realtime)    │ │
│  │                                                          │ │
│  │  ┌────────────────────────────────────────────────────┐  │ │
│  │  │            Inherited from Root Layout             │  │ │
│  │  │         Web3Provider (WagmiProvider)              │  │ │
│  │  │        RainbowKitProvider (Unchanged)             │  │ │
│  │  │         QueryClientProvider (Reused)              │  │ │
│  │  └────────────────────────────────────────────────────┘  │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │          Frontend Components (src/components/arcslots/)  │ │
│  │                                                          │ │
│  │  ┌───────────┐  ┌──────────┐  ┌─────────────────────┐   │ │
│  │  │SlotMachine│  │SlotReel  │  │ PoolDisplay        │   │ │
│  │  │           │  │          │  │ ┌─────────────────┐│   │ │
│  │  │ • Spin    │  │ • Animate│  │ │ useQuery:      ││   │ │
│  │  │ • USDC    │  │ • 3 Reels│  │ │ - getPool()    ││   │ │
│  │  │ • Network │  │ • Symbols│  │ │ - getGlobalStats││   │ │
│  │  │   Check   │  │          │  │ │ Refetch: 5s    ││   │ │
│  │  │ • TX Send │  │          │  │ └─────────────────┘│   │ │
│  │  └───────────┘  └──────────┘  └─────────────────────┘   │ │
│  │                                                          │ │
│  │  ┌──────────────────┐  ┌─────────────────────────────┐  │ │
│  │  │   StatsBar       │  │  GiftBox Modal              │  │ │
│  │  │                  │  │  • Pending payouts          │  │ │
│  │  │ supabase.channel│  │  • Claim transactions       │  │ │
│  │  │ • Live stats    │  │  • Fee calculation (1%)     │  │ │
│  │  │ • Connection    │  │                             │  │ │
│  │  │   status        │  │                             │  │ │
│  │  └──────────────────┘  └─────────────────────────────┘  │ │
│  │                                                          │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │      Backend Layer (src/lib/arcslots/)                  │ │
│  │                                                          │ │
│  │  ┌────────────────────────────────────────────────────┐ │ │
│  │  │  arcslots.constants.ts (IMMUTABLE CONFIG)          │ │ │
│  │  │  ──────────────────────────────────────────────── │ │ │
│  │  │  • SPIN_FEE = "1" USDC (6 decimals)              │ │ │
│  │  │  • ARC_DECIMALS = 18                             │ │ │
│  │  │  • SYMBOL_MULTIPLIERS (10x-200x)                 │ │ │
│  │  │  • ARCSLOTS_ADDRESS, USDC_ADDRESS, ARC_ADDRESS   │ │ │
│  │  │  • Table names, validation patterns              │ │ │
│  │  └────────────────────────────────────────────────────┘ │ │
│  │                                                          │ │
│  │  ┌────────────────────────────────────────────────────┐ │ │
│  │  │  arcslots.functions.ts (SERVER ACTIONS)            │ │ │
│  │  │  ──────────────────────────────────────────────── │ │ │
│  │  │  ✓ getPool(userAddress)                           │ │ │
│  │  │  ✓ getGlobalStats()                               │ │ │
│  │  │  ✓ getTreasuryInfo()                              │ │ │
│  │  │  ✓ confirmDonation(user, amount, txHash)          │ │ │
│  │  │  ✓ confirmSpin(user, spins, txHash, symbols)      │ │ │
│  │  │  ✓ getPendingPayouts(userAddress)                 │ │ │
│  │  │  ✓ claimJackpot(user, payoutId, txHash)           │ │ │
│  │  │  ✓ getLiveStats()                                 │ │ │
│  │  │                                                    │ │ │
│  │  │  All with Zod-inspired input validation           │ │ │
│  │  │  Separate decimal handling (6 vs 18)              │ │ │
│  │  │  Error handling & logging                         │ │ │
│  │  └────────────────────────────────────────────────────┘ │ │
│  │                                                          │ │
│  └──────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
                            │
                            │ Supabase
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
  ┌─────────────┐   ┌──────────────┐   ┌──────────────┐
  │arcslots_pool│   │arcslots_spins│   │arcslots_stats│
  │             │   │              │   │_live         │
  │ • User bal. │   │ • Spin hist. │   │              │
  │ • Total won │   │ • Multiplier │   │ • Volume     │
  │ • Total spin│   │ • TX hash    │   │ • Active     │
  └─────────────┘   └──────────────┘   │ • Big win    │
        │                   │           │              │
        └───────────────────┼───────────┴──────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
  │arcslots_     │   │arcslots_     │   │Arc Testnet   │
  │donations     │   │payouts       │   │Blockchain    │
  │              │   │              │   │              │
  │ • User addr  │   │ • User addr  │   │ • USDC Token │
  │ • Amount     │   │ • Amount ARC │   │ • ARC Token  │
  │ • TX hash    │   │ • Status     │   │ • ArcSlots   │
  │              │   │ • Fee        │   │   Contract   │
  └──────────────┘   └──────────────┘   └──────────────┘


┌─────────────────────────────────────────────────────────────────┐
│                  Data Flow: Spin Transaction                     │
│                                                                 │
│  User clicks "Spin" on /slots                                   │
│         │                                                       │
│         ▼                                                       │
│  SlotMachine validates:                                         │
│  • Wallet connected ✓                                           │
│  • Correct network (5042002) ✓                                  │
│  • Valid spin count (1-100) ✓                                   │
│         │                                                       │
│         ▼                                                       │
│  Component calls: writeContractAsync (USDC.approve)             │
│  • Amount: parseUnits(SPIN_FEE, 6)                              │
│  • Token: USDC_ADDRESS                                          │
│  • Spender: ARCSLOTS_ADDRESS                                    │
│         │                                                       │
│         ▼                                                       │
│  Component calls: sendTransactionAsync (spin transaction)       │
│  • To: ARCSLOTS_ADDRESS                                         │
│  • Data: encoded spin call                                      │
│         │                                                       │
│         ▼                                                       │
│  Generate random symbols (3 reels)                              │
│         │                                                       │
│         ▼                                                       │
│  Call Server Action: confirmSpin()                              │
│  • userAddress                                                  │
│  • numSpins                                                     │
│  • txHash (proof of on-chain TX)                                │
│  • symbols (game result)                                        │
│         │                                                       │
│         ▼                                                       │
│  Server Action validates:                                       │
│  • Address format ✓                                             │
│  • TX hash format ✓                                             │
│  • Spin count bounds ✓                                          │
│         │                                                       │
│         ▼                                                       │
│  Insert to arcslots_spins table:                                │
│  • user_address, num_spins, symbols, tx_hash                    │
│  • Calculate: multiplier from symbol combo                      │
│  • Calculate: arc_reward = multiplier * numSpins                │
│         │                                                       │
│         ▼                                                       │
│  Update arcslots_pool table:                                    │
│  • balance_arc += arc_reward                                    │
│  • total_spins += num_spins                                     │
│  • total_won += arc_reward                                      │
│         │                                                       │
│         ▼                                                       │
│  Return result to UI:                                           │
│  • spin_id, symbols, multiplier, arc_reward                     │
│         │                                                       │
│         ▼                                                       │
│  PoolDisplay re-fetches via React Query                         │
│  StatsBar updates via Supabase listener                         │
│  SlotReel animates the final symbols                            │
│         │                                                       │
│         ▼                                                       │
│  User sees: "Won 50 ARC! Multiplier: 5x"                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────────┐
│                  Isolation Guarantees                            │
│                                                                 │
│  ✓ Separate configuration (no shared constants)                │
│  ✓ Separate state management (no context mixing)               │
│  ✓ Separate database tables (no data cross-pollination)        │
│  ✓ Separate server functions (no logic mixing)                 │
│  ✓ Separate decimal handling (USDC ≠ ARC)                      │
│  ✓ Zero modifications to existing modules                      │
│  ✓ Web3Provider unchanged                                      │
│  ✓ Main dashboard untouched                                    │
│  ✓ Independent routing (/slots is separate)                    │
│  ✓ Self-contained styling (Tailwind)                           │
│                                                                 │
│  Regression Risk: ZERO ✅                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Dependencies

```
SlotMachine.tsx
├── imports: Wagmi, Viem, arcslots.functions, arcslots.constants
├── depends on: Web3Provider (inherited), sendTransactionAsync, writeContractAsync
└── outputs: onSpinComplete callback

SlotReel.tsx
├── imports: Framer Motion, arcslots.constants
├── depends on: isSpinning state, finalSymbols prop
└── outputs: animation component with status

PoolDisplay.tsx
├── imports: React Query, Wagmi, arcslots.functions
├── depends on: useQuery, useAccount
└── outputs: user pool + global stats display

StatsBar.tsx
├── imports: Supabase, arcslots.constants
├── depends on: supabase.channel (realtime)
└── outputs: live metrics display

GiftBox.tsx
├── imports: Wagmi, arcslots.functions
├── depends on: useAccount, sendTransactionAsync
└── outputs: modal with claim functionality

SlotsPage
├── imports: all above components
├── depends on: Web3Provider context (inherited)
└── outputs: complete game interface
```

---

## Data Models

```
User Pool
┌─────────────────────────┐
│ id (UUID)               │
│ user_address (TEXT)     │
│ balance_usdc (DECIMAL)  │ ← 6 decimals
│ balance_arc (DECIMAL)   │ ← 18 decimals
│ total_spins (INT)       │
│ total_won (DECIMAL)     │ ← 18 decimals
│ created_at              │
│ updated_at              │
└─────────────────────────┘

Spin Transaction
┌─────────────────────────┐
│ id (UUID)               │
│ user_address (TEXT)     │
│ num_spins (INT)         │ 1-100
│ symbols (TEXT[])        │ ["🎯", "💎", "⚡"]
│ multiplier (INT)        │ Based on combo
│ arc_reward (DECIMAL)    │ ← 18 decimals
│ tx_hash (TEXT)          │ Blockchain proof
│ status (TEXT)           │ confirmed
│ created_at              │
└─────────────────────────┘

Pending Payout
┌─────────────────────────┐
│ id (UUID)               │
│ user_address (TEXT)     │
│ amount_arc (DECIMAL)    │ ← 18 decimals
│ status (TEXT)           │ pending/claimed
│ tx_hash_claim (TEXT)    │ Claim TX
│ claimed_at              │
│ net_amount (DECIMAL)    │ after 1% fee
│ created_at              │
└─────────────────────────┘
```

---

## Production Deployment Flow

```
Local Development
    │
    ├─ npm run dev
    ├─ Test /slots page
    ├─ Verify Web3 integration
    └─ Check Supabase connection
    │
    ▼
Build & Validation
    │
    ├─ npm run build
    ├─ npx tsc --noEmit
    ├─ npm run lint
    └─ Verify ZERO warnings
    │
    ▼
Commit & Push
    │
    ├─ git add .
    ├─ git commit -m "feat: Add ArcSlots"
    ├─ git push origin main
    └─ GitHub triggers webhook
    │
    ▼
Vercel Deployment
    │
    ├─ Vercel detects push
    ├─ Builds project
    ├─ Deploys to production
    └─ https://your-domain.vercel.app/slots ✅
    │
    ▼
Post-Launch Monitoring
    │
    ├─ Check error rates
    ├─ Monitor Supabase queries
    ├─ Review user feedback
    └─ Optimize as needed
```

---

**Architecture Diagram Created: June 2, 2026**  
**Confidence Level: 🟢 Production Ready**
