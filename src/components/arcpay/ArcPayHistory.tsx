'use client';

import React, { useEffect, useState } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { ArrowDownLeft, ArrowUpRight, ExternalLink, Loader2 } from 'lucide-react';
import { formatEther } from 'viem';

interface HistoricalTx {
  hash: string;
  type: 'send' | 'receive';
  amount: string;
  token: string;
  counterparty: string;
  timestamp: number;
}

export function ArcPayHistory() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const [transactions, setTransactions] = useState<HistoricalTx[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!address || !publicClient) return;

    // In a fully scaled production app, fetching full transaction history is done via an Indexer 
    // (e.g. The Graph, Alchemy, or a dedicated Arc Chain block explorer API).
    // For this Web3 dashboard MVP on Arc Testnet, we'll simulate the robust UI with graceful 
    // fallback parsing to prevent blank fields, assuming a block explorer API returns standard format.
    
    const fetchHistory = async () => {
      try {
        // Simulated network request latency for the UI demonstration
        await new Promise(r => setTimeout(r, 1000));
        
        // Empty for MVP unless we integrate with a real indexer
        setTransactions([]);
      } catch (error) {
        console.error("Failed to fetch history:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, [address, publicClient]);

  if (!address) {
    return <div className="text-center p-8 text-slate-500">Connect wallet to view transaction history</div>;
  }

  return (
    <div className="bg-[#0a0a16] border border-slate-800 rounded-3xl overflow-hidden">
      <div className="p-6 border-b border-slate-800 bg-[#0d0e1c]">
        <h3 className="text-lg font-bold text-white">Arc Chain Transaction History</h3>
        <p className="text-xs text-slate-400">Native ARC & USDC transfers</p>
      </div>
      
      <div className="p-0">
        {isLoading ? (
          <div className="flex justify-center p-12"><Loader2 className="animate-spin text-cyan-400" /></div>
        ) : transactions.length === 0 ? (
          <div className="text-center p-12 text-slate-500">No recent transactions found</div>
        ) : (
          <div className="divide-y divide-slate-800">
            {transactions.map((tx, idx) => (
              <div key={idx} className="p-4 hover:bg-slate-800/30 transition-colors flex items-center justify-between">
                
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.type === 'receive' ? 'bg-green-500/10 text-green-400' : 'bg-blue-500/10 text-blue-400'}`}>
                    {tx.type === 'receive' ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">
                      {tx.type === 'receive' ? 'Received from' : 'Sent to'} <span className="font-mono text-slate-300">{tx.counterparty || 'Unknown'}</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(tx.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className={`text-base font-bold ${tx.type === 'receive' ? 'text-green-400' : 'text-white'}`}>
                      {tx.type === 'receive' ? '+' : '-'}{tx.amount || '0.00'} {tx.token || 'ARC'}
                    </p>
                  </div>
                  
                  <a href={`https://explorer.testnet.arc.network/tx/${tx.hash}`} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-cyan-400 transition-colors">
                    <ExternalLink size={18} />
                  </a>
                </div>

              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
