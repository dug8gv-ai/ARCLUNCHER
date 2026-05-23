import { ethers } from "hardhat";

async function main() {
  const usdcAddress = "0x3600000000000000000000000000000000000000";
  const eurcAddress = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a";
  const cirBtcAddress = "0xe2bbfd47b4704EfeBe8F2874ac54943ea5c030fB";
  const vaultAddress = "0x5343FD3D284Eb2D1a07567807E437c193ae9A161";
  
  const [deployer] = await ethers.getSigners();
  console.log("Funding vault with account:", deployer.address);

  const erc20Abi = [
    "function decimals() view returns (uint8)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function balanceOf(address) view returns (uint256)"
  ];

  const fundToken = async (address: string, amount: string, name: string) => {
    try {
      const token = await ethers.getContractAt(erc20Abi, address);
      const decimals = await token.decimals();
      const rawAmount = ethers.parseUnits(amount, decimals);
      
      const bal = await token.balanceOf(deployer.address);
      console.log(`Deployer balance of ${name}: ${ethers.formatUnits(bal, decimals)}`);
      
      if (bal >= rawAmount) {
        const tx = await token.transfer(vaultAddress, rawAmount);
        await tx.wait();
        console.log(`Successfully funded Vault with ${amount} ${name}`);
      } else {
        console.log(`Deployer does not have enough ${name} to fund vault.`);
      }
    } catch (e: any) {
      console.log(`Failed to fund ${name}: ${e.message}`);
    }
  };

  await fundToken(usdcAddress, "50000", "USDC");
  await fundToken(eurcAddress, "50000", "EURC");
  await fundToken(cirBtcAddress, "50", "cirBTC");

  console.log("Funding complete.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
