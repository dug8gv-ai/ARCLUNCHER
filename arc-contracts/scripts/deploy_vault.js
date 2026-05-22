import { ethers } from "ethers";
import fs from "fs";
import * as dotenv from "dotenv";
dotenv.config();

async function main() {
  const vaultArtifact = JSON.parse(fs.readFileSync("./artifacts/contracts/ArcGlobalVault.sol/ArcGlobalVault.json", "utf8"));
  const mockBTCArtifact = JSON.parse(fs.readFileSync("./artifacts/contracts/MockCirBTC.sol/MockCirBTC.json", "utf8"));
  
  const provider = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network");
  
  let privateKey = process.env.PRIVATE_KEY;
  if (!privateKey.startsWith("0x")) privateKey = "0x" + privateKey;
  
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log("Deploying from:", wallet.address);

  // Deploy MockCirBTC
  const btcFactory = new ethers.ContractFactory(mockBTCArtifact.abi, mockBTCArtifact.bytecode, wallet);
  const cirBTCContract = await btcFactory.deploy();
  await cirBTCContract.waitForDeployment();
  const CIRBTC_ADDRESS = await cirBTCContract.getAddress();
  console.log("MockCirBTC deployed to:", CIRBTC_ADDRESS);

  const USDC_ADDRESS = ethers.getAddress("0x3600000000000000000000000000000000000000");
  const EURC_ADDRESS = ethers.getAddress("0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a");
  const ADMIN_ADDRESS = ethers.getAddress("0x218b09A7d9FF6D69082Ac605bb27029bC321B5C3"); // Treasury

  // Deploy Vault
  const vaultFactory = new ethers.ContractFactory(vaultArtifact.abi, vaultArtifact.bytecode, wallet);
  const vaultContract = await vaultFactory.deploy(USDC_ADDRESS, EURC_ADDRESS, CIRBTC_ADDRESS, ADMIN_ADDRESS);
  await vaultContract.waitForDeployment();
  const VAULT_ADDRESS = await vaultContract.getAddress();

  console.log("ArcGlobalVault deployed to:", VAULT_ADDRESS);
  
  // Seed Vault with liquidity
  // USDC & EURC - might need to call mint or we just use whatever the wallet has. 
  // For cirBTC, we minted 100 to the deployer. Send 50 to Vault.
  const tx = await cirBTCContract.transfer(VAULT_ADDRESS, ethers.parseUnits("50", 8));
  await tx.wait();
  console.log("Sent 50 cirBTC to Vault");
}

main().catch(console.error);
