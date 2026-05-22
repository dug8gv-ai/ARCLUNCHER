export const ARC_DEFI_ROUTER_ADDRESS = '0x9D70C92BaeEe37fccd5Cf29A3be069234b54Fa5E';
export const ARC_GLOBAL_POOL_ADDRESS = '0xcA12baf07ABC4DfE54D68E137dCDa9eb480E0268';
export const ARC_GLOBAL_VAULT_ADDRESS = '0x5343FD3D284Eb2D1a07567807E437c193ae9A161';
import poolAbiRaw from './arcPoolAbi.json';
import vaultAbiRaw from './arcVaultAbi.json';
export const arcPoolAbi = poolAbiRaw;
export const arcVaultAbi = vaultAbiRaw.abi;

export const USDC_ADDRESS = '0x3600000000000000000000000000000000000000';
export const EURC_ADDRESS = '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a';
export const CIRBTC_ADDRESS = '0xe2bbfd47b4704EfeBe8F2874ac54943ea5c030fB';

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
