export const BINARY_MARKET_ADDRESS = "0xD0b620cBD0839F5168e7F87e6FE08E519647B8e4" as const;

export const arcBinaryMarketAbi = [
  // ── Constructor ────────────────────────────────────────────────────────────
  {
    "inputs": [
      { "internalType": "address[]", "name": "_tokens",      "type": "address[]" },
      { "internalType": "address",   "name": "_feeReceiver", "type": "address"   }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  // ── Events ─────────────────────────────────────────────────────────────────
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true,  "internalType": "uint256", "name": "roundId",    "type": "uint256" },
      { "indexed": true,  "internalType": "address", "name": "bettor",     "type": "address" },
      { "indexed": false, "internalType": "uint8",   "name": "direction",  "type": "uint8"   },
      { "indexed": false, "internalType": "uint256", "name": "amount",     "type": "uint256" }
    ],
    "name": "BetPlaced",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true,  "internalType": "uint256", "name": "roundId",     "type": "uint256" },
      { "indexed": false, "internalType": "address", "name": "token",       "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "strikePrice", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "closeTime",   "type": "uint256" }
    ],
    "name": "RoundOpened",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true,  "internalType": "uint256", "name": "roundId",    "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "finalPrice", "type": "uint256" },
      { "indexed": false, "internalType": "uint8",   "name": "winningSide","type": "uint8"   }
    ],
    "name": "RoundSettled",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true,  "internalType": "uint256", "name": "roundId", "type": "uint256" },
      { "indexed": true,  "internalType": "address", "name": "bettor",  "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "payout",  "type": "uint256" }
    ],
    "name": "WinningsClaimed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [{ "indexed": false, "internalType": "address", "name": "token", "type": "address" }],
    "name": "TokenAdded",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [{ "indexed": false, "internalType": "address", "name": "token", "type": "address" }],
    "name": "TokenRemoved",
    "type": "event"
  },
  // ── View constants ─────────────────────────────────────────────────────────
  {
    "inputs": [], "name": "UP",
    "outputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }],
    "stateMutability": "view", "type": "function"
  },
  {
    "inputs": [], "name": "DOWN",
    "outputs": [{ "internalType": "uint8", "name": "", "type": "uint8" }],
    "stateMutability": "view", "type": "function"
  },
  {
    "inputs": [], "name": "ROUND_DURATION",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view", "type": "function"
  },
  {
    "inputs": [], "name": "HOUSE_FEE_BPS",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view", "type": "function"
  },
  // ── State variables ────────────────────────────────────────────────────────
  {
    "inputs": [], "name": "owner",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view", "type": "function"
  },
  {
    "inputs": [], "name": "feeReceiver",
    "outputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "stateMutability": "view", "type": "function"
  },
  {
    "inputs": [], "name": "nextRoundId",
    "outputs": [{ "internalType": "uint256", "name": "", "type": "uint256" }],
    "stateMutability": "view", "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "", "type": "address" }],
    "name": "supportedTokens",
    "outputs": [{ "internalType": "bool", "name": "", "type": "bool" }],
    "stateMutability": "view", "type": "function"
  },
  // ── Core view functions ────────────────────────────────────────────────────
  {
    "inputs": [{ "internalType": "uint256", "name": "roundId", "type": "uint256" }],
    "name": "getRound",
    "outputs": [
      {
        "components": [
          { "internalType": "uint256", "name": "id",            "type": "uint256" },
          { "internalType": "address", "name": "token",         "type": "address" },
          { "internalType": "uint256", "name": "strikePrice",   "type": "uint256" },
          { "internalType": "uint256", "name": "finalPrice",    "type": "uint256" },
          { "internalType": "uint256", "name": "openTime",      "type": "uint256" },
          { "internalType": "uint256", "name": "closeTime",     "type": "uint256" },
          { "internalType": "uint256", "name": "totalUpPool",   "type": "uint256" },
          { "internalType": "uint256", "name": "totalDownPool", "type": "uint256" },
          { "internalType": "uint8",   "name": "winningSide",   "type": "uint8"   },
          { "internalType": "bool",    "name": "settled",       "type": "bool"    }
        ],
        "internalType": "struct ArcBinaryMarket.Round",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "roundId", "type": "uint256" },
      { "internalType": "address", "name": "user",    "type": "address" }
    ],
    "name": "getUserBets",
    "outputs": [
      {
        "components": [
          { "internalType": "address", "name": "bettor",    "type": "address" },
          { "internalType": "uint256", "name": "amount",    "type": "uint256" },
          { "internalType": "uint8",   "name": "direction", "type": "uint8"   },
          { "internalType": "bool",    "name": "claimed",   "type": "bool"    }
        ],
        "internalType": "struct ArcBinaryMarket.Bet[]",
        "name": "",
        "type": "tuple[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "roundId", "type": "uint256" }],
    "name": "getActiveBettors",
    "outputs": [
      { "internalType": "uint256", "name": "upCount",   "type": "uint256" },
      { "internalType": "uint256", "name": "downCount", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getSupportedTokens",
    "outputs": [{ "internalType": "address[]", "name": "", "type": "address[]" }],
    "stateMutability": "view",
    "type": "function"
  },
  // ── Admin write functions ──────────────────────────────────────────────────
  {
    "inputs": [
      { "internalType": "address", "name": "token",       "type": "address" },
      { "internalType": "uint256", "name": "strikePrice", "type": "uint256" }
    ],
    "name": "openRound",
    "outputs": [{ "internalType": "uint256", "name": "roundId", "type": "uint256" }],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "roundId",    "type": "uint256" },
      { "internalType": "uint256", "name": "finalPrice", "type": "uint256" }
    ],
    "name": "settleRound",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "token", "type": "address" }],
    "name": "addToken",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "token", "type": "address" }],
    "name": "removeToken",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "_fr", "type": "address" }],
    "name": "setFeeReceiver",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "address", "name": "_new", "type": "address" }],
    "name": "transferOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // ── User write functions ───────────────────────────────────────────────────
  {
    "inputs": [
      { "internalType": "uint256", "name": "roundId",   "type": "uint256" },
      { "internalType": "uint8",   "name": "direction", "type": "uint8"   },
      { "internalType": "uint256", "name": "amount",    "type": "uint256" }
    ],
    "name": "placeBet",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "roundId", "type": "uint256" }],
    "name": "claimWinnings",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
] as const;
