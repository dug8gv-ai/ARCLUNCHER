
import { ethers } from "hardhat";

async function main() {
  const usdcAddress = "0x3600000000000000000000000000000000000000";
  const userAddress = "0x218b09A7d9FF6D69082Ac605bb27029bC321B5C3";
  
  const [deployer] = await ethers.getSigners();
  console.log("Running check with account:", deployer.address);

  const usdc = await ethers.getContractAt([
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function balanceOf(address) view returns (uint256)"
  ], usdcAddress);
  
  try {
    const name = await usdc.name();
    const symbol = await usdc.symbol();
    const decimals = await usdc.decimals();
    const balance = await usdc.balanceOf(userAddress);
    
    console.log("Token Name:", name);
    console.log("Symbol:", symbol);
    console.log("Decimals:", decimals);
    console.log("User Balance (raw):", balance.toString());
    console.log("User Balance (formatted):", ethers.formatUnits(balance, decimals));
  } catch (err: any) {
    console.error("Error fetching token info:", err.message);
  }

  const nativeBalance = await ethers.provider.getBalance(userAddress);
  console.log("Native Balance (raw):", nativeBalance.toString());
  console.log("Native Balance (formatted):", ethers.formatUnits(nativeBalance, 18));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
