const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const ArcLauncher = await hre.ethers.getContractFactory("ArcLauncher");
  console.log("Deploying ArcLauncher...");
  const launcher = await ArcLauncher.deploy();

  await launcher.waitForDeployment();

  const launcherAddress = await launcher.getAddress();
  console.log("ArcLauncher deployed to:", launcherAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
