export const ARC_DEFI_ROUTER_ADDRESS = '0x9D70C92BaeEe37fccd5Cf29A3be069234b54Fa5E';
export const ARC_LIQUIDITY_POOL_ADDRESS = '0xBF734b4f24A5A5F8D722bf2aaB7992E8ffFB9eb8';

export const USDC_ADDRESS = '0x3600000000000000000000000000000000000000';
export const EURC_ADDRESS = '0xeC00000000000000000000000000000000000000';

export const arcDefiRouterAbi = [
  {
    "inputs": [
      { "internalType": "address", "name": "token", "type": "address" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "burn",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "token", "type": "address" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" },
      { "internalType": "uint256", "name": "durationInSeconds", "type": "uint256" }
    ],
    "name": "lock",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "token", "type": "address" }
    ],
    "name": "unlock",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

export const arcLiquidityPoolAbi = [
  {
    "inputs": [
      { "internalType": "uint256", "name": "usdcAmountIn", "type": "uint256" }
    ],
    "name": "swapUSDCtoEURC",
    "outputs": [
      { "internalType": "uint256", "name": "eurcAmountOut", "type": "uint256" }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "eurcAmountIn", "type": "uint256" }
    ],
    "name": "swapEURCtoUSDC",
    "outputs": [
      { "internalType": "uint256", "name": "usdcAmountOut", "type": "uint256" }
    ],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "address", "name": "token", "type": "address" },
      { "internalType": "uint256", "name": "amount", "type": "uint256" }
    ],
    "name": "burnToken",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "usdcAmount", "type": "uint256" },
      { "internalType": "uint256", "name": "eurcAmount", "type": "uint256" }
    ],
    "name": "addLiquidity",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "uint256", "name": "usdcAmount", "type": "uint256" },
      { "internalType": "uint256", "name": "eurcAmount", "type": "uint256" }
    ],
    "name": "removeLiquidity",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "getReserves",
    "outputs": [
      { "internalType": "uint256", "name": "_reserveUSDC", "type": "uint256" },
      { "internalType": "uint256", "name": "_reserveEURC", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      { "internalType": "bool", "name": "usdcToEurc", "type": "bool" },
      { "internalType": "uint256", "name": "amountIn", "type": "uint256" }
    ],
    "name": "getSwapEstimate",
    "outputs": [
      { "internalType": "uint256", "name": "amountOut", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "reserveUSDC",
    "outputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "reserveEURC",
    "outputs": [
      { "internalType": "uint256", "name": "", "type": "uint256" }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];
