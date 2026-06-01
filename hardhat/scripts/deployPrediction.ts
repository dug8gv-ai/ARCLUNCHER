import hre from "hardhat";

async function main() {
  if (!hre.ethers) {
    throw new Error("Ethers plugin not found in HRE.");
  }

  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying PredictionMarket with account:", deployer.address);

  const PredictionMarket = await hre.ethers.getContractFactory("PredictionMarket");
  const predictionMarket = await PredictionMarket.deploy();
  await predictionMarket.waitForDeployment();

  const address = await predictionMarket.getAddress();
  console.log("PredictionMarket deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
