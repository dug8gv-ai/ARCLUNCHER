import hre from "hardhat";

async function main() {
  // Ensure ethers is available from hre
  if (!hre.ethers) {
    throw new Error("Ethers plugin not found in HRE. Check your hardhat.config.ts");
  }
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const ArcLauncher = await hre.ethers.getContractFactory("ArcLauncher");
  console.log("Deploying ArcLauncher...");
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
