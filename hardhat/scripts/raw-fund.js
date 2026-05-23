import { ethers } from "ethers";
import dotenv from "dotenv";

dotenv.config();

async function main() {
  const provider = new ethers.JsonRpcProvider("https://rpc.testnet.arc.network");
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

  const usdcAddress = "0x3600000000000000000000000000000000000000";
  const eurcAddress = "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a";
  const vaultAddress = "0x5343FD3D284Eb2D1a07567807E437c193ae9A161";
  
  console.log("Funding vault with account:", wallet.address);

  const erc20Abi = [
    "function decimals() view returns (uint8)",
    "function transfer(address to, uint256 amount) returns (bool)",
    "function balanceOf(address) view returns (uint256)"
  ];

  const fundToken = async (address, amount, name) => {
    try {
      const token = new ethers.Contract(address, erc20Abi, wallet);
      const decimals = await token.decimals();
      const rawAmount = ethers.parseUnits(amount, Number(decimals));
      
      const bal = await token.balanceOf(wallet.address);
      console.log(`Deployer balance of ${name}: ${ethers.formatUnits(bal, decimals)}`);
      
      if (bal >= rawAmount) {
        const tx = await token.transfer(vaultAddress, rawAmount);
        await tx.wait();
        console.log(`Successfully funded Vault with ${amount} ${name}`);
      } else {
        console.log(`Deployer does not have enough ${name} to fund vault.`);
      }
    } catch (e) {
      console.log(`Failed to fund ${name}: ${e.message}`);
    }
  };

  await fundToken(usdcAddress, "0.5", "USDC");
  await fundToken(eurcAddress, "100", "EURC");

  console.log("Funding complete.");
}

main().catch(console.error);
