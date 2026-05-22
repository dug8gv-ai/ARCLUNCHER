'use client';

import { Terminal, Copy, CheckCircle, Code, Shield } from 'lucide-react';
import { useState } from 'react';
import { ARC_GLOBAL_VAULT_ADDRESS } from '@/lib/arcDefiAbi';

export function DeveloperGuide() {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const handleCopy = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(null), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">ARC GLOBAL DEVELOPER GUIDE</h2>
        <p className="text-slate-500 mt-2">SDK-Lite for the V4 Precise Ultra-Low Fee Vault Engine</p>
      </div>

      {/* Contract Info */}
      <div className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-200/80">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-2xl">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900">Public Vault Contract</h3>
            <p className="text-sm text-slate-500">Deploy integrations on Arc Testnet</p>
          </div>
        </div>

        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between">
          <code className="text-blue-600 font-mono font-bold text-sm">{ARC_GLOBAL_VAULT_ADDRESS}</code>
          <button
            onClick={() => handleCopy(ARC_GLOBAL_VAULT_ADDRESS, 'address')}
            className="p-2 hover:bg-slate-200 rounded-xl transition-colors"
          >
            {copiedSection === 'address' ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-slate-400" />}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
            <p className="font-bold text-slate-900 mb-1">Fixed Fee Swap Engine</p>
            <p className="text-sm text-slate-600">A flat 0.1 fee is charged per swap (USDC/EURC/cirBTC equivalents). All fees automatically settle to the treasury.</p>
          </div>
          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
            <p className="font-bold text-slate-900 mb-1">Single-Hop Atomic Swaps</p>
            <p className="text-sm text-slate-600">Bypass multi-hop routers completely. Swaps are executed instantly against vault liquidity reserves.</p>
          </div>
        </div>
      </div>

      {/* Code Snippets */}
      <div className="bg-white rounded-[32px] p-8 shadow-sm border border-slate-200/80">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl">
            <Code className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-slate-900">Integration Snippets</h3>
        </div>

        <div className="space-y-6">
          {/* Swap Snippet */}
          <div>
            <h4 className="text-sm font-bold text-slate-700 uppercase mb-3">Execute a Swap (ethers.js)</h4>
            <div className="bg-slate-900 rounded-2xl p-4 relative group">
              <button
                onClick={() => handleCopy(swapSnippet, 'swap')}
                className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
              >
                {copiedSection === 'swap' ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-300" />}
              </button>
              <pre className="text-sm text-blue-300 font-mono overflow-x-auto whitespace-pre-wrap">
                {swapSnippet}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const swapSnippet = `// 1. Approve USDC spending for the vault
const tx1 = await usdcContract.approve(
  "${ARC_GLOBAL_VAULT_ADDRESS}",
  ethers.parseUnits("100", 6)
);
await tx1.wait();

// 2. Call executeSwap on the Vault
// Signature: executeSwap(address tokenIn, address tokenOut, uint256 amountIn) returns (uint256)
// Note: Amount must be > flat fee.
const tx2 = await vaultContract.executeSwap(
  USDC_ADDRESS,
  EURC_ADDRESS,
  ethers.parseUnits("100", 6)
);
await tx2.wait();`;
