async function main() {
  console.log("Deploying ArcSlots contract...");

  const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const ArcSlots = await hre.ethers.getContractFactory("ArcSlots");
  const arcSlots = await ArcSlots.deploy(USDC_ADDRESS, deployer.address);
  
  await arcSlots.waitForDeployment();
  const address = await arcSlots.getAddress();
  
  console.log("ArcSlots deployed to:", address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
