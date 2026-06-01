const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  const PredictionMarket = await hre.ethers.getContractFactory("PredictionMarket");
  console.log("Deploying PredictionMarket...");
  const predictionMarket = await PredictionMarket.deploy();

  await predictionMarket.waitForDeployment();

  const address = await predictionMarket.getAddress();
  console.log("PredictionMarket deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
