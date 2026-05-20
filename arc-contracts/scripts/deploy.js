import hre from "hardhat";

async function main() {
  console.log("Deploying ArcDefiRouter...");
  const ethers = hre.ethers;

  const ArcDefiRouter = await ethers.getContractFactory("ArcDefiRouter");
  const arcDefiRouter = await ArcDefiRouter.deploy();

  await arcDefiRouter.waitForDeployment();

  console.log("ArcDefiRouter deployed to:", await arcDefiRouter.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
