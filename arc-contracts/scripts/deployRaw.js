import { ethers } from "ethers";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) throw new Error("PRIVATE_KEY not found in .env");

  const rpcUrl = "https://rpc.testnet.arc.network";
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log("Deploying ArcSlots contract with wallet:", wallet.address);

  const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";
  
  const artifactPath = "./artifacts/contracts/ArcSlots.sol/ArcSlots.json";
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const arcSlots = await factory.deploy(USDC_ADDRESS, wallet.address);
  
  await arcSlots.waitForDeployment();
  const address = await arcSlots.getAddress();
  
  console.log("ArcSlots deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
