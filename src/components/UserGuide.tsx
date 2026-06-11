'use client';

import { useState } from 'react';
import { BookOpen, Coins, Send, Rocket, TrendingUp, CheckCircle, PlusCircle, AlertCircle, Info, Briefcase, MessageCircle, DollarSign, Trash2, ImagePlus, UserCheck, Bell } from 'lucide-react';
import { USDC_ADDRESS, EURC_ADDRESS, CIRBTC_ADDRESS } from '@/lib/arcDefiAbi';

export default function UserGuide() {
  const [addingUsdc, setAddingUsdc] = useState(false);
  const [addingEurc, setAddingEurc] = useState(false);
  const [addingCirbtc, setAddingCirbtc] = useState(false);
  const [addStatus, setAddStatus] = useState<{ token: string, status: 'success' | 'error' | null }>({ token: '', status: null });

  const tokenMeta = {
    USDC: { address: USDC_ADDRESS, decimals: 6, accent: 'bg-blue-600 hover:bg-blue-700' },
    EURC: { address: EURC_ADDRESS, decimals: 6, accent: 'bg-indigo-600 hover:bg-indigo-700' },
    cirBTC: { address: CIRBTC_ADDRESS, decimals: 8, accent: 'bg-amber-600 hover:bg-amber-700' },
  } as const;

  const handleAddToWallet = async (tokenSymbol: keyof typeof tokenMeta) => {
    if (tokenSymbol === 'USDC') setAddingUsdc(true);
    if (tokenSymbol === 'EURC') setAddingEurc(true);
    if (tokenSymbol === 'cirBTC') setAddingCirbtc(true);
    setAddStatus({ token: '', status: null });

    try {
      if (typeof window.ethereum !== 'undefined') {
        const wasAdded = await window.ethereum.request({
          method: 'wallet_watchAsset',
          params: {
            type: 'ERC20',
            options: {
              address: tokenMeta[tokenSymbol].address,
              symbol: tokenSymbol,
              decimals: tokenMeta[tokenSymbol].decimals,
            },
          },
        });

        if (wasAdded) {
          setAddStatus({ token: tokenSymbol, status: 'success' });
        } else {
          setAddStatus({ token: tokenSymbol, status: 'error' });
        }
      } else {
        alert('Web3 wallet (like MetaMask) is not detected. Please install one to use this feature.');
      }
    } catch (error) {
      console.error(`Error adding ${tokenSymbol} to wallet:`, error);
      setAddStatus({ token: tokenSymbol, status: 'error' });
    } finally {
      if (tokenSymbol === 'USDC') setAddingUsdc(false);
      if (tokenSymbol === 'EURC') setAddingEurc(false);
      if (tokenSymbol === 'cirBTC') setAddingCirbtc(false);

      setTimeout(() => setAddStatus({ token: '', status: null }), 3000);
    }
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-blue-600 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <BookOpen size={120} />
        </div>
        <div className="relative z-10">
          <h1 className="text-3xl font-black mb-2 flex items-center gap-3">
            <BookOpen className="text-indigo-200" />
            ArcOmni Guide
          </h1>
          <p className="text-indigo-100 max-w-2xl text-sm leading-relaxed font-medium">
            Welcome to the ultimate hub for decentralized finance on the ARC Testnet. This guide will walk you through everything you need to know to swap, send, launch, and trade assets seamlessly.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* CircleBridge */}
        <div className="card rounded-3xl p-6 shadow-sm border border-[var(--border-dim)] hover:shadow-md transition-all">
          <div className="w-12 h-12 bg-[rgba(0,242,254,0.05)] text-[var(--accent-cyan)] rounded-2xl flex items-center justify-center mb-4">
            <Coins size={24} />
          </div>
          <h2 className="text-lg font-black text-[var(--text-primary)] mb-2">1. Circle Bridge & Swaps</h2>
          <p className="text-sm text-[var(--text-secondary)] mb-4 leading-relaxed">
            The Financial Layer allows you to instantly swap between Native USDC and EURC stablecoins. 
            Because ARC Testnet uses USDC natively, you can swap it directly for EURC with very low fees.
          </p>
          <ul className="text-xs text-[var(--text-secondary)] space-y-2 font-medium">
            <li className="flex items-start gap-2">
              <CheckCircle size={14} className="text-green-500 mt-0.5 shrink-0" />
              <span>Swap USDC to EURC (or vice versa) instantly via our liquidity pools.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle size={14} className="text-green-500 mt-0.5 shrink-0" />
              <span>Cross-chain compatible design using standard ERC-20 structures.</span>
            </li>
          </ul>
        </div>

        {/* SocialPay */}
        <div className="card rounded-3xl p-6 shadow-sm border border-[var(--border-dim)] hover:shadow-md transition-all">
          <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mb-4">
            <Send size={24} />
          </div>
          <h2 className="text-lg font-black text-[var(--text-primary)] mb-2">2. SocialPay</h2>
          <p className="text-sm text-[var(--text-secondary)] mb-4 leading-relaxed">
            Forget complex wallet addresses. SocialPay lets you send USDC, EURC, or any ARC token directly to your friends using their connected Discord or Twitter handles.
          </p>
          <ul className="text-xs text-[var(--text-secondary)] space-y-2 font-medium">
            <li className="flex items-start gap-2">
              <CheckCircle size={14} className="text-green-500 mt-0.5 shrink-0" />
              <span>Send funds by searching @username.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle size={14} className="text-green-500 mt-0.5 shrink-0" />
              <span>Standard 0x... address transfers are also fully supported.</span>
            </li>
          </ul>
        </div>

        {/* Token Launchpad */}
        <div className="card rounded-3xl p-6 shadow-sm border border-[var(--border-dim)] hover:shadow-md transition-all">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-4">
            <Rocket size={24} />
          </div>
          <h2 className="text-lg font-black text-[var(--text-primary)] mb-2">3. Arc Token Launchpad</h2>
          <p className="text-sm text-[var(--text-secondary)] mb-4 leading-relaxed">
            Deploy your own cryptocurrency in seconds. The Launchpad handles the complex smart contract compilation behind the scenes.
          </p>
          <ul className="text-xs text-[var(--text-secondary)] space-y-2 font-medium">
            <li className="flex items-start gap-2">
              <CheckCircle size={14} className="text-green-500 mt-0.5 shrink-0" />
              <span>Set your Token Name, Symbol, and Initial Supply.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle size={14} className="text-green-500 mt-0.5 shrink-0" />
              <span>Deploy securely to the ARC Testnet instantly.</span>
            </li>
          </ul>
        </div>

        {/* Trading & Airdrops */}
        <div className="card rounded-3xl p-6 shadow-sm border border-[var(--border-dim)] hover:shadow-md transition-all">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-4">
            <TrendingUp size={24} />
          </div>
          <h2 className="text-lg font-black text-[var(--text-primary)] mb-2">4. Trading & Airdrops</h2>
          <p className="text-sm text-[var(--text-secondary)] mb-4 leading-relaxed">
            Trade top assets on the decentralized exchange and climb the leaderboard. Engaging with the platform earns you valuable ARCL points.
          </p>
          <ul className="text-xs text-[var(--text-secondary)] space-y-2 font-medium">
            <li className="flex items-start gap-2">
              <CheckCircle size={14} className="text-green-500 mt-0.5 shrink-0" />
              <span>Earn ARCL Airdrop points for every transaction.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle size={14} className="text-green-500 mt-0.5 shrink-0" />
              <span>Check your rank on the live community leaderboard.</span>
            </li>
          </ul>
        </div>

      </div>

      {/* ==================== ARC FREELANCE HUB GUIDE ==================== */}
      <div className="bg-gradient-to-r from-indigo-600 to-violet-600 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10"><Briefcase size={120} /></div>
        <div className="relative z-10">
          <p className="text-indigo-200 text-[10px] font-black uppercase tracking-widest mb-2">Complete Guide</p>
          <h2 className="text-2xl font-black mb-2 flex items-center gap-3"><Briefcase className="text-indigo-200" /> Arc Freelance Hub</h2>
          <p className="text-indigo-100 max-w-2xl text-sm leading-relaxed font-medium">
            A decentralized freelance marketplace built on Arc Chain. Post jobs, apply for gigs, chat with clients, and get paid in USDC — all on-chain.
          </p>
        </div>
      </div>

      {/* Step by step flow */}
      <div className="card rounded-3xl p-6 shadow-sm border border-[var(--border-dim)]">
        <h3 className="text-lg font-black text-[var(--text-primary)] mb-5 flex items-center gap-2"><Briefcase size={18} className="text-indigo-600" /> How It Works — Full Flow</h3>
        <div className="space-y-4">
          {[
            { step: '01', title: 'Connect Your Wallet', desc: 'Connect your Web3 wallet (MetaMask or any WalletConnect wallet) to Arc Testnet. You need USDC to post gigs or pay freelancers.', color: 'bg-[rgba(0,242,254,0.05)] border-[var(--border-dim)] text-[var(--accent-cyan)]' },
            { step: '02', title: 'Post a Gig (Client)', desc: 'Click "+ Post Gig". Fill in Job Title, Description, and Budget in USDC. Optionally upload a cover image. Toggle "Add Proposal Samples" to attach up to 2 portfolio images showcasing your work style.', color: 'bg-indigo-50 border-indigo-200 text-indigo-700' },
            { step: '03', title: 'Browse the Gigs Board', desc: 'All posted gigs appear on the "Gigs Board" tab. Anyone can see all open, in-progress, and completed gigs. Click on a client\'s name/avatar to view their profile.', color: 'bg-violet-50 border-violet-200 text-violet-700' },
            { step: '04', title: 'Accept a Gig (Freelancer)', desc: 'See an OPEN gig you want to work on? Click "Accept Gig". Your wallet address is recorded as the freelancer and the gig status changes to IN PROGRESS.', color: 'bg-amber-50 border-amber-200 text-amber-700' },
            { step: '05', title: 'Chat in Real-Time', desc: 'Click "Open Chat" on any gig to open the live chat. Messages are stored in Supabase and update in real-time. Click any user\'s avatar in chat to view their full profile.', color: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
            { step: '06', title: 'Pay & Complete (Client)', desc: 'Once the work is done, the client clicks "Pay & Complete". A confirmation modal shows the amount, freelancer name, and wallet. Confirm → USDC is sent on-chain → gig marked COMPLETED.', color: 'bg-green-50 border-green-200 text-green-700' },
            { step: '07', title: 'Direct USDC Payment', desc: 'You can also pay anyone directly from their profile or from the chat header "Pay" button — without completing a gig. Enter any USDC amount and confirm the on-chain transfer.', color: 'bg-rose-50 border-rose-200 text-rose-700' },
          ].map(item => (
            <div key={item.step} className={`flex gap-4 p-4 rounded-2xl border ${item.color}`}>
              <div className="w-8 h-8 rounded-xl bg-[var(--bg-card)]/60 flex items-center justify-center font-black text-xs flex-shrink-0">{item.step}</div>
              <div>
                <p className="font-black text-sm">{item.title}</p>
                <p className="text-xs mt-1 leading-relaxed opacity-80">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        <div className="card rounded-3xl p-6 shadow-sm border border-[var(--border-dim)] hover:shadow-md transition-all">
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-4"><ImagePlus size={22} /></div>
          <h3 className="text-base font-black text-[var(--text-primary)] mb-2">Proposal Samples</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-3 leading-relaxed">When posting a gig, toggle "Add Proposal Samples" to attach up to 2 portfolio images. These appear side-by-side on your gig card so clients can see your work quality before hiring.</p>
          <ul className="text-xs text-[var(--text-secondary)] space-y-1.5 font-medium">
            <li className="flex items-start gap-2"><CheckCircle size={13} className="text-green-500 mt-0.5 shrink-0" /> Max 2 images per gig</li>
            <li className="flex items-start gap-2"><CheckCircle size={13} className="text-green-500 mt-0.5 shrink-0" /> Images are compressed automatically</li>
            <li className="flex items-start gap-2"><CheckCircle size={13} className="text-green-500 mt-0.5 shrink-0" /> Shown with a "Proposal" badge on the card</li>
          </ul>
        </div>

        <div className="card rounded-3xl p-6 shadow-sm border border-[var(--border-dim)] hover:shadow-md transition-all">
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-4"><MessageCircle size={22} /></div>
          <h3 className="text-base font-black text-[var(--text-primary)] mb-2">Live Chat System</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-3 leading-relaxed">Every gig has a built-in real-time chat. Messages update instantly via Supabase Realtime. The gig owner gets a notification badge on "My Gigs" when a new message arrives.</p>
          <ul className="text-xs text-[var(--text-secondary)] space-y-1.5 font-medium">
            <li className="flex items-start gap-2"><CheckCircle size={13} className="text-green-500 mt-0.5 shrink-0" /> Real-time messages (no refresh needed)</li>
            <li className="flex items-start gap-2"><CheckCircle size={13} className="text-green-500 mt-0.5 shrink-0" /> Red badge shows unread count</li>
            <li className="flex items-start gap-2"><CheckCircle size={13} className="text-green-500 mt-0.5 shrink-0" /> Click any avatar to view full profile</li>
          </ul>
        </div>

        <div className="card rounded-3xl p-6 shadow-sm border border-[var(--border-dim)] hover:shadow-md transition-all">
          <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mb-4"><DollarSign size={22} /></div>
          <h3 className="text-base font-black text-[var(--text-primary)] mb-2">Payment System</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-3 leading-relaxed">Two ways to pay on Arc Freelance Hub — both are real on-chain USDC transfers on Arc Testnet.</p>
          <ul className="text-xs text-[var(--text-secondary)] space-y-1.5 font-medium">
            <li className="flex items-start gap-2"><CheckCircle size={13} className="text-green-500 mt-0.5 shrink-0" /> <span><strong>Gig Payment:</strong> Client clicks "Pay & Complete" → confirmation modal → on-chain USDC sent → gig marked COMPLETED</span></li>
            <li className="flex items-start gap-2"><CheckCircle size={13} className="text-green-500 mt-0.5 shrink-0" /> <span><strong>Direct Payment:</strong> Click "Pay" in chat header or from any user's profile → enter amount → send USDC directly</span></li>
          </ul>
        </div>

        <div className="card rounded-3xl p-6 shadow-sm border border-[var(--border-dim)] hover:shadow-md transition-all">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-4"><Trash2 size={22} /></div>
          <h3 className="text-base font-black text-[var(--text-primary)] mb-2">Delete Gig (1 Week Rule)</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-3 leading-relaxed">You can delete your own OPEN gigs using the red trash icon on the gig card. To prevent spam, only 1 gig can be deleted per week per wallet.</p>
          <ul className="text-xs text-[var(--text-secondary)] space-y-1.5 font-medium">
            <li className="flex items-start gap-2"><CheckCircle size={13} className="text-green-500 mt-0.5 shrink-0" /> Only OPEN gigs can be deleted</li>
            <li className="flex items-start gap-2"><CheckCircle size={13} className="text-green-500 mt-0.5 shrink-0" /> 1 delete per wallet per 7 days</li>
            <li className="flex items-start gap-2"><CheckCircle size={13} className="text-green-500 mt-0.5 shrink-0" /> All chat messages are also deleted</li>
          </ul>
        </div>

        <div className="card rounded-3xl p-6 shadow-sm border border-[var(--border-dim)] hover:shadow-md transition-all">
          <div className="w-12 h-12 bg-[rgba(0,242,254,0.05)] text-[var(--accent-cyan)] rounded-2xl flex items-center justify-center mb-4"><UserCheck size={22} /></div>
          <h3 className="text-base font-black text-[var(--text-primary)] mb-2">User Profiles</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-3 leading-relaxed">Click any user's avatar — on a gig card or inside chat — to open their profile modal showing their name, bio, and wallet address.</p>
          <ul className="text-xs text-[var(--text-secondary)] space-y-1.5 font-medium">
            <li className="flex items-start gap-2"><CheckCircle size={13} className="text-green-500 mt-0.5 shrink-0" /> Profile pulls from the Arc profiles table</li>
            <li className="flex items-start gap-2"><CheckCircle size={13} className="text-green-500 mt-0.5 shrink-0" /> "Send USDC" button opens direct payment</li>
            <li className="flex items-start gap-2"><CheckCircle size={13} className="text-green-500 mt-0.5 shrink-0" /> Auto-generated avatar if no profile set</li>
          </ul>
        </div>

        <div className="card rounded-3xl p-6 shadow-sm border border-[var(--border-dim)] hover:shadow-md transition-all">
          <div className="w-12 h-12 bg-violet-50 text-violet-600 rounded-2xl flex items-center justify-center mb-4"><Bell size={22} /></div>
          <h3 className="text-base font-black text-[var(--text-primary)] mb-2">Notifications</h3>
          <p className="text-sm text-[var(--text-secondary)] mb-3 leading-relaxed">Gig owners get live notifications when someone messages on their gig. A red badge appears on the "My Gigs" tab showing the unread count.</p>
          <ul className="text-xs text-[var(--text-secondary)] space-y-1.5 font-medium">
            <li className="flex items-start gap-2"><CheckCircle size={13} className="text-green-500 mt-0.5 shrink-0" /> Real-time via Supabase Realtime</li>
            <li className="flex items-start gap-2"><CheckCircle size={13} className="text-green-500 mt-0.5 shrink-0" /> Badge clears when you open chat</li>
            <li className="flex items-start gap-2"><CheckCircle size={13} className="text-green-500 mt-0.5 shrink-0" /> Only counts messages from others</li>
          </ul>
        </div>

      </div>

      {/* Gig Status Guide */}
      <div className="card rounded-3xl p-6 shadow-sm border border-[var(--border-dim)]">
        <h3 className="text-lg font-black text-[var(--text-primary)] mb-4">Gig Status Explained</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
            <span className="inline-block px-2.5 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-black uppercase rounded-lg mb-2">OPEN</span>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">Gig is available. Any user (except the poster) can click "Accept Gig" to start working on it.</p>
          </div>
          <div className="bg-[rgba(0,242,254,0.05)] border border-[var(--border-dim)] rounded-2xl p-4">
            <span className="inline-block px-2.5 py-1 bg-[rgba(0,242,254,0.1)] text-[var(--accent-cyan)] text-[10px] font-black uppercase rounded-lg mb-2">IN PROGRESS</span>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">A freelancer has accepted the gig. Client can see who is working and release payment when done.</p>
          </div>
          <div className="bg-[var(--bg-card)] border border-[var(--border-dim)] rounded-2xl p-4">
            <span className="inline-block px-2.5 py-1 bg-[rgba(8,14,44,0.8)] text-[var(--text-primary)] text-[10px] font-black uppercase rounded-lg mb-2">COMPLETED</span>
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">Payment has been sent on-chain. The gig is archived and visible for reference.</p>
          </div>
        </div>
      </div>

      {/* Add to Wallet Section */}
      <div className="bg-gradient-to-br from-slate-50 to-slate-100 border border-[var(--border-dim)] rounded-3xl p-6 mt-8">
        <div className="flex items-center gap-2 mb-4">
          <Info className="text-[var(--text-secondary)]" size={20} />
          <h2 className="text-lg font-black text-[var(--text-primary)]">Official Token Contracts</h2>
        </div>
        <p className="text-sm text-[var(--text-secondary)] mb-6 font-medium">
          To see your USDC, EURC, and cirBTC balances correctly in your Web3 wallet (like MetaMask), import their contract addresses below. The add-to-wallet flow uses wallet_watchAsset so the tokens appear in your wallet portfolio immediately.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* USDC Add */}
          <div className="card rounded-2xl p-4 flex flex-col gap-3 shadow-sm">
            <div>
              <div className="font-black text-[var(--text-primary)] text-sm">USDC (USD Coin)</div>
              <div className="text-[10px] font-mono text-[var(--text-secondary)] mt-1 break-all">{USDC_ADDRESS}</div>
            </div>
            <button
              onClick={() => handleAddToWallet('USDC')}
              disabled={addingUsdc}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                addStatus.token === 'USDC' && addStatus.status === 'success' ? 'bg-green-100 text-green-700' :
                addStatus.token === 'USDC' && addStatus.status === 'error' ? 'bg-red-100 text-red-700' :
                'bg-blue-600 hover:bg-blue-700 text-white shadow-md'
              }`}
            >
              {addingUsdc ? 'Adding...' :
               addStatus.token === 'USDC' && addStatus.status === 'success' ? <><CheckCircle size={14} /> Added</> :
               addStatus.token === 'USDC' && addStatus.status === 'error' ? <><AlertCircle size={14} /> Failed</> :
               <><PlusCircle size={14} /> Add to Wallet</>}
            </button>
          </div>

          {/* EURC Add */}
          <div className="card rounded-2xl p-4 flex flex-col gap-3 shadow-sm">
            <div>
              <div className="font-black text-[var(--text-primary)] text-sm">EURC (Euro Coin)</div>
              <div className="text-[10px] font-mono text-[var(--text-secondary)] mt-1 break-all">{EURC_ADDRESS}</div>
            </div>
            <button
              onClick={() => handleAddToWallet('EURC')}
              disabled={addingEurc}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                addStatus.token === 'EURC' && addStatus.status === 'success' ? 'bg-green-100 text-green-700' :
                addStatus.token === 'EURC' && addStatus.status === 'error' ? 'bg-red-100 text-red-700' :
                'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md'
              }`}
            >
              {addingEurc ? 'Adding...' :
               addStatus.token === 'EURC' && addStatus.status === 'success' ? <><CheckCircle size={14} /> Added</> :
               addStatus.token === 'EURC' && addStatus.status === 'error' ? <><AlertCircle size={14} /> Failed</> :
               <><PlusCircle size={14} /> Add to Wallet</>}
            </button>
          </div>

          {/* cirBTC Add */}
          <div className="card rounded-2xl p-4 flex flex-col gap-3 shadow-sm">
            <div>
              <div className="font-black text-[var(--text-primary)] text-sm">cirBTC (Wrapped Bitcoin)</div>
              <div className="text-[10px] font-mono text-[var(--text-secondary)] mt-1 break-all">{CIRBTC_ADDRESS}</div>
            </div>
            <button
              onClick={() => handleAddToWallet('cirBTC')}
              disabled={addingCirbtc}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                addStatus.token === 'cirBTC' && addStatus.status === 'success' ? 'bg-green-100 text-green-700' :
                addStatus.token === 'cirBTC' && addStatus.status === 'error' ? 'bg-red-100 text-red-700' :
                'bg-amber-600 hover:bg-amber-700 text-white shadow-md'
              }`}
            >
              {addingCirbtc ? 'Adding...' :
               addStatus.token === 'cirBTC' && addStatus.status === 'success' ? <><CheckCircle size={14} /> Added</> :
               addStatus.token === 'cirBTC' && addStatus.status === 'error' ? <><AlertCircle size={14} /> Failed</> :
               <><PlusCircle size={14} /> Add to Wallet</>}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
