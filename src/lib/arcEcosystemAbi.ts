export const ECOSYSTEM_USDC_ADDRESS = '0x0421250fDAb679469Cc2CE7b822CdFe98075B5C3';
export const ECOSYSTEM_EURC_ADDRESS = '0x7a829f075d97f48A1100bE2390f7A667Bd3B43C0';
export const ECOSYSTEM_CRBTC_ADDRESS = '0x3231F3bDE983570F7317CbC66b56D83431D58B9C';

// Fallback/Mock factory address for watching events until the real one is provided
export const ECOSYSTEM_FACTORY_ADDRESS = '0x0000000000000000000000000000000000000000';
export const ECOSYSTEM_ROUTER_ADDRESS = '0x0000000000000000000000000000000000000000';

export const ecosystemFactoryAbi = [
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "tokenAddress", "type": "address" },
      { "indexed": false, "internalType": "string", "name": "name", "type": "string" },
      { "indexed": false, "internalType": "string", "name": "ticker", "type": "string" },
      { "indexed": false, "internalType": "uint256", "name": "timestamp", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "initialSupply", "type": "uint256" }
    ],
    "name": "TokenCreated",
    "type": "event"
  }
] as const;

export const ecosystemRouterAbi = [
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "sender", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "tokenIn", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "tokenOut", "type": "address" },
      { "indexed": false, "internalType": "uint256", "name": "amountIn", "type": "uint256" },
      { "indexed": false, "internalType": "uint256", "name": "amountOut", "type": "uint256" },
      { "indexed": false, "internalType": "bool", "name": "isBuy", "type": "bool" }
    ],
    "name": "Swap",
    "type": "event"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "tokenIn", "type": "address" },
      { "internalType": "address", "name": "tokenOut", "type": "address" },
      { "internalType": "uint256", "name": "amountIn", "type": "uint256" },
      { "internalType": "uint256", "name": "amountOutMin", "type": "uint256" }
    ],
    "name": "swapExactTokensForTokens",
    "outputs": [
      { "internalType": "uint256[]", "name": "amounts", "type": "uint256[]" }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  }
] as const;
