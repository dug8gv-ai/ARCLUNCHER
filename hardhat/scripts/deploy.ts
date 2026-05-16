import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // The treasury address will receive the 1 USDC fee
  const TREASURY_ADDRESS = deployer.address; // Setting the deployer as the treasury for now

  const ArcLauncher = await ethers.getContractFactory("ArcLauncher");
  const launcher = await ArcLauncher.deploy();

  await launcher.waitForDeployment();

  const launcherAddress = await launcher.getAddress();
  console.log("ArcLauncher deployed to:", launcherAddress);
  
  console.log(`\nNext Steps:
  1. Add this address to NEXT_PUBLIC_LAUNCHER_ADDRESS in your Next.js .env.local file:
     NEXT_PUBLIC_LAUNCHER_ADDRESS=${launcherAddress}
  2. Make sure you also set the NEXT_PUBLIC_USDC_ADDRESS for the Arc Testnet.
  `);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
