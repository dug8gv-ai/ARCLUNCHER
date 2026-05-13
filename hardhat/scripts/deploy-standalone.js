import { ethers } from "ethers";
import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function main() {
  const provider = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network");
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  console.log("Deploying contracts with the account:", wallet.address);

  const artifactPath = path.resolve(__dirname, "../artifacts/contracts/ArcLauncher.sol/ArcLauncher.json");
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  
  console.log("Deploying ArcLauncher...");
  const launcher = await factory.deploy(wallet.address);

  await launcher.waitForDeployment();

  const launcherAddress = await launcher.getAddress();
  console.log("ArcLauncher deployed to:", launcherAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
