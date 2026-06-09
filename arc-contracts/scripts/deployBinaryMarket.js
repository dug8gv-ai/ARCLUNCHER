import { ethers } from "ethers";
import { writeFileSync } from "fs";
import { createRequire } from "module";
import * as dotenv from "dotenv";
dotenv.config();

const require = createRequire(import.meta.url);

const USDC_ADDRESS  = "0x0421250FDaB679469Cc2cE7b822Cdfe98075B5C3";
const EURC_ADDRESS  = "0x7A829F075d97F48A1100bE2390f7A667Bd3B43c0";
const CRBTC_ADDRESS = "0x3231f3BDe983570F7317CbC66b56D83431D58b9c";
const FEE_RECEIVER  = "0x218b09A7d9FF6D69082Ac605bb27029bC321B5C3";

async function main() {
  const provider = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network");
  const pk = process.env.PRIVATE_KEY?.startsWith('0x') ? process.env.PRIVATE_KEY : `0x${process.env.PRIVATE_KEY}`;
  const wallet = new ethers.Wallet(pk, provider);

  console.log("Deploying with:", wallet.address);

  // Load artifact
  const artifact = require("../artifacts/contracts/ArcBinaryMarket.sol/ArcBinaryMarket.json");
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);

  console.log("Deploying ArcBinaryMarket...");
  const contract = await factory.deploy(
    [USDC_ADDRESS, EURC_ADDRESS, CRBTC_ADDRESS],
    FEE_RECEIVER
  );
  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log("✅ ArcBinaryMarket deployed to:", address);

  const output = {
    address,
    chainId: 5042002,
    abi: artifact.abi,
    tokens: { USDC: USDC_ADDRESS, EURC: EURC_ADDRESS, crBTC: CRBTC_ADDRESS },
    feeReceiver: FEE_RECEIVER,
    deployedAt: new Date().toISOString(),
  };

  writeFileSync("./scripts/binary_market_deployment.json", JSON.stringify(output, null, 2));
  console.log("Saved to scripts/binary_market_deployment.json");
  console.log("Contract address:", address);
}

main().catch(err => { console.error(err); process.exit(1); });
