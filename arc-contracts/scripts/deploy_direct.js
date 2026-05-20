import { ethers } from "ethers";
import fs from "fs";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const artifact = JSON.parse(fs.readFileSync("./artifacts/contracts/ArcDefiRouter.sol/ArcDefiRouter.json", "utf8"));
  
  const provider = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network");
  
  let privateKey = process.env.PRIVATE_KEY;
  if (!privateKey.startsWith("0x")) privateKey = "0x" + privateKey;
  
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log("Deploying ArcDefiRouter from:", wallet.address);

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  console.log("ArcDefiRouter deployed to:", await contract.getAddress());
}

main().catch(console.error);
