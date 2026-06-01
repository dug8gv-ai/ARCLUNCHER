import fs from 'fs';
import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

const ADMIN_ADDRESS = '0x218b09A7d9FF6D69082Ac605bb27029bC321B5C3';

async function main() {
  const rpc = "https://rpc.testnet.arc.network";
  const provider = new ethers.JsonRpcProvider(rpc);
  
  if (!process.env.PRIVATE_KEY) throw new Error("PRIVATE_KEY not found in .env");
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  const artifact = JSON.parse(fs.readFileSync('./artifacts/contracts/PredictionMarket.sol/PredictionMarket.json', 'utf8'));
  
  console.log("Deploying PredictionMarket from:", wallet.address);
  console.log("Setting admin to:", ADMIN_ADDRESS);
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy(ADMIN_ADDRESS);
  await contract.waitForDeployment();
  
  const address = await contract.getAddress();
  console.log("PredictionMarket deployed to:", address);
}

main().catch(console.error);
