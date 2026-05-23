import { AppKit } from "@circle-fin/app-kit";
import { createViemAdapterFromProvider } from "@circle-fin/adapter-viem-v2";

let appKitInstance: AppKit | null = null;
let fetchIntercepted = false;

// Intercept browser fetch to route Circle API calls through our Next.js backend proxy to bypass CORS
const interceptFetchForCircleProxy = () => {
  if (typeof window === 'undefined' || fetchIntercepted) return;
  
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    let [resource, config] = args;
    let url = typeof resource === 'string' ? resource : (resource instanceof Request ? resource.url : '');
    
    if (url.includes('api.circle.com') || url.includes('api-sandbox.circle.com')) {
      const proxyConfig: RequestInit = {
        ...(config || {}),
        headers: {
          ...(config?.headers || {}),
          'x-circle-target-url': url
        }
      };
      
      return originalFetch('/api/circle/proxy', proxyConfig);
    }
    
    return originalFetch(resource, config);
  };
  
  fetchIntercepted = true;
};

// Initialize the global App Kit instance if not already initialized
export const initAppKit = (): AppKit => {
  interceptFetchForCircleProxy();
  if (!appKitInstance) {
    appKitInstance = new AppKit();
  }
  return appKitInstance;
};

// Create a Viem adapter from a Wagmi/EIP-1193 provider
export const createBrowserAdapter = async (provider: any) => {
  if (!provider) {
    throw new Error("No provider available for App Kit adapter.");
  }
  return await createViemAdapterFromProvider({ provider });
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

  // Fetch kit key securely from backend API
  let kitKey = '';
  try {
    const res = await fetch('/api/circle/kit-key');
    if (res.ok) {
      const data = await res.json();
      kitKey = data.kitKey || '';
    }
  } catch (e) {
    console.warn('Failed to fetch kit key from server, falling back to env.');
  }

  // Fallback to NEXT_PUBLIC env var if API fails
  if (!kitKey) {
    kitKey = process.env.NEXT_PUBLIC_CIRCLE_APP_KIT_KEY || '';
  }

  if (!kitKey) {
    throw new Error('Circle App Kit Key is not configured. Please set CIRCLE_APP_KIT_KEY in environment variables.');
  }

  return await kit.swap({
    from: { adapter, chain: chain as any },
    amountIn: amountIn,
    tokenIn: fromToken as any,
    tokenOut: toToken as any,
    config: { kitKey }
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
