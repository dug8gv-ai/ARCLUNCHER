import { ethers } from "ethers";
import fs from "fs";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const artifact = JSON.parse(fs.readFileSync("./artifacts/contracts/ArcLiquidityPool.sol/ArcLiquidityPool.json", "utf8"));
  
  const provider = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network");
  
  let privateKey = process.env.PRIVATE_KEY;
  if (!privateKey.startsWith("0x")) privateKey = "0x" + privateKey;
  
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log("Deploying ArcLiquidityPool from:", wallet.address);

  const USDC_ADDRESS = ethers.getAddress("0x3600000000000000000000000000000000000000");
  const EURC_ADDRESS = ethers.getAddress("0xec00000000000000000000000000000000000000");
  const ADMIN_ADDRESS = ethers.getAddress("0x218b09A7d9FF6D69082Ac605bb27029bC321B5C3");

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy(USDC_ADDRESS, EURC_ADDRESS, ADMIN_ADDRESS);
  await contract.waitForDeployment();

  console.log("ArcLiquidityPool deployed to:", await contract.getAddress());
}

main().catch(console.error);
