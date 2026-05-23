import { AppKit } from "@circle-fin/app-kit";
import { createViemAdapterFromProvider } from "@circle-fin/adapter-viem-v2";

let appKitInstance: AppKit | null = null;

// Initialize the global App Kit instance if not already initialized
export const initAppKit = (): AppKit => {
  if (!appKitInstance) {
    appKitInstance = new AppKit();
  }
  return appKitInstance;
};

// Create a Viem adapter from a Wagmi/EIP-1193 provider
export const createBrowserAdapter = (provider: any) => {
  if (!provider) {
    throw new Error("No provider available for App Kit adapter.");
  }
  return createViemAdapterFromProvider({ provider });
};

// Helper for Bridge
export const appKitBridge = async (
  adapter: any,
  destinationAdapter: any,
  amount: string,
  fromChain: string = "Arc_Testnet",
  toChain: string = "Ethereum_Sepolia" // Example default destination
) => {
  const kit = initAppKit();
  return await kit.bridge({
    from: { adapter, chain: fromChain as any },
    to: { adapter: destinationAdapter, chain: toChain as any },
    amount,
  } as any);
};

// Helper for Swap
export const appKitSwap = async (
  adapter: any,
  amountIn: string,
  fromToken: string,
  toToken: string,
  chain: string = "Arc_Testnet"
) => {
  const kit = initAppKit();
  const kitKey = process.env.NEXT_PUBLIC_CIRCLE_APP_KIT_KEY || '';
  
  if (!kitKey || kitKey === 'placeholder_key') {
    console.warn("Missing Circle App Kit Key for swap operations.");
    // In a real scenario, this might throw or handle fallback
  }

  return await kit.swap({
    from: { adapter, chain: chain as any },
    amount: amountIn,
    tokenIn: fromToken as any,
    tokenOut: toToken as any,
    ...(kitKey && { config: { kitKey } })
  } as any); 
};

// Helper for Send
export const appKitSend = async (
  adapter: any,
  amount: string,
  token: string,
  destinationAddress: string,
  chain: string = "Arc_Testnet"
) => {
  const kit = initAppKit();
  return await (kit as any).send({
    adapter,
    chain: chain as any,
    amount,
    token,
    destinationAddress,
  });
};
