'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { supabase } from '@/lib/supabase';
import { Briefcase, Loader2, Plus, Clock, CheckCircle2, User, Wallet, DollarSign, Send } from 'lucide-react';
import { appKitSend, createBrowserAdapter } from '@/lib/appKit';

interface Gig {
  id: string;
  client_wallet: string;
  title: string;
  description: string;
  budget: number;
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED';
  freelancer_wallet: string | null;
  created_at: string;
  clientProfile?: any;
  freelancerProfile?: any;
}

export function FreelanceHub() {
  const { isConnected, address: userAddress, connector } = useAccount();

  const [activeTab, setActiveTab] = useState<'board' | 'my_gigs'>('board');
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [loading, setLoading] = useState(true);

  // Post Gig Modal
  const [isPosting, setIsPosting] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newBudget, setNewBudget] = useState('');
  const [postLoading, setPostLoading] = useState(false);

  const fetchGigs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('freelance_gigs')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        // Fetch profiles
        const wallets = new Set<string>();
        data.forEach(g => {
          wallets.add(g.client_wallet);
          if (g.freelancer_wallet) wallets.add(g.freelancer_wallet);
        });

        let profilesMap: Record<string, any> = {};
        if (wallets.size > 0) {
          const { data: pData } = await supabase
            .from('profiles')
            .select('*')
            .in('wallet', Array.from(wallets));
          if (pData) {
            pData.forEach(p => {
              profilesMap[p.wallet] = p;
            });
          }
        }

        const enriched = data.map(g => ({
          ...g,
          clientProfile: profilesMap[g.client_wallet] || { name: 'Anonymous', avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${g.client_wallet}` },
          freelancerProfile: g.freelancer_wallet ? (profilesMap[g.freelancer_wallet] || { name: 'Anonymous', avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${g.freelancer_wallet}` }) : null
        }));

        setGigs(enriched);
      }
    } catch (err) {
      console.error('Error fetching gigs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGigs();
  }, []);

  const handlePostGig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userAddress) return alert('Please connect wallet first.');
    if (!newTitle || !newDesc || !newBudget) return;

    try {
      setPostLoading(true);
      await supabase.from('freelance_gigs').insert({
        client_wallet: userAddress.toLowerCase(),
        title: newTitle,
        description: newDesc,
        budget: Number(newBudget),
        status: 'OPEN'
      });
      setIsPosting(false);
      setNewTitle('');
      setNewDesc('');
      setNewBudget('');
      fetchGigs();
    } catch (err) {
      console.error(err);
      alert('Failed to post gig.');
    } finally {
      setPostLoading(false);
    }
  };

  const handleApply = async (gigId: string) => {
    if (!userAddress) return alert('Please connect wallet.');
    try {
      await supabase
        .from('freelance_gigs')
        .update({
          status: 'IN_PROGRESS',
          freelancer_wallet: userAddress.toLowerCase()
        })
        .eq('id', gigId);
      fetchGigs();
    } catch (err) {
      console.error(err);
    }
  };

  const handlePayFreelancer = async (gig: Gig) => {
    if (!userAddress) return;
    if (!gig.freelancer_wallet) return;

    try {
      // 1. Pay via Arc Social Pay (AppKit)
      let provider = typeof window !== 'undefined' && (window as any).ethereum ? (window as any).ethereum : await connector?.getProvider();
      if (!provider) {
         throw new Error("No Web3 Provider available");
      }
      const adapter = createBrowserAdapter(provider);
      await appKitSend(adapter, String(gig.budget), "USDC", gig.freelancer_wallet, "Arc_Testnet");

      // 2. Mark as completed in db
      await supabase
        .from('freelance_gigs')
        .update({ status: 'COMPLETED' })
        .eq('id', gig.id);
        
      fetchGigs();
      alert('Payment sent successfully!');
    } catch (err: any) {
      console.error(err);
      alert('Payment failed: ' + (err.message || 'Unknown error'));
    }
  };

  const filteredGigs = activeTab === 'board' 
    ? gigs.filter(g => g.status === 'OPEN')
    : gigs.filter(g => g.client_wallet === userAddress?.toLowerCase() || g.freelancer_wallet === userAddress?.toLowerCase());

  return (
    <div className="space-y-6">
      
      {/* Header & Tabs */}
      <div className="bg-white border border-slate-200/80 rounded-[32px] p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5 mb-6">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center border border-indigo-100 text-indigo-600 shadow-sm shadow-indigo-500/5">
              <Briefcase size={22} />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900">Arc Freelance Hub</h2>
              <p className="text-xs text-slate-500 font-semibold">Post crypto gigs or apply to earn USDC.</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('board')}
                className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${
                  activeTab === 'board' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Gigs Board
              </button>
              <button
                onClick={() => setActiveTab('my_gigs')}
                className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${
                  activeTab === 'my_gigs' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                My Gigs
              </button>
            </div>
            <button
              onClick={() => setIsPosting(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 sm:px-4 sm:py-2 rounded-xl text-xs font-black transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-1.5"
            >
              <Plus size={16} /> <span className="hidden sm:inline">Post Gig</span>
            </button>
          </div>
        </div>

        {/* Modal: Post Gig */}
        {isPosting && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
              <h3 className="text-lg font-black text-slate-800 mb-4">Post a New Gig</h3>
              <form onSubmit={handlePostGig} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Job Title</label>
                  <input required value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="e.g. Design a logo for Arc" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Description</label>
                  <textarea required value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Details of the job..." className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500 min-h-[100px]" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Budget (USDC)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input required type="number" min="1" value={newBudget} onChange={e => setNewBudget(e.target.value)} placeholder="50" className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black outline-none focus:border-indigo-500" />
                  </div>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setIsPosting(false)} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black">Cancel</button>
                  <button type="submit" disabled={postLoading} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 disabled:opacity-50">
                    {postLoading ? <Loader2 className="animate-spin size-4" /> : 'Post Gig'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Gigs List */}
        <div className="space-y-4">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
              <Loader2 className="animate-spin size-8 text-indigo-500" />
              <p className="text-xs font-bold uppercase tracking-widest">Loading Gigs...</p>
            </div>
          ) : filteredGigs.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                <Briefcase size={24} className="text-slate-300" />
              </div>
              <h3 className="text-base font-black text-slate-700">No Gigs Found</h3>
              <p className="text-xs text-slate-500 font-semibold mt-1">Check back later or post a new gig!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredGigs.map(gig => (
                <div key={gig.id} className="border border-slate-200 rounded-2xl p-5 bg-white hover:shadow-md transition-all flex flex-col h-full relative overflow-hidden group">
                  
                  {/* Status Badge */}
                  <div className={`absolute top-0 right-0 px-3 py-1 text-[9px] font-black uppercase tracking-wider rounded-bl-lg ${
                    gig.status === 'OPEN' ? 'bg-emerald-100 text-emerald-600' :
                    gig.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-600' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {gig.status.replace('_', ' ')}
                  </div>

                  <div className="flex justify-between items-start mb-3 mt-2">
                    <h3 className="text-lg font-black text-slate-800 pr-16 leading-tight">{gig.title}</h3>
                  </div>
                  
                  <p className="text-xs text-slate-500 mb-4 flex-1">{gig.description}</p>
                  
                  <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-auto">
                    <div className="flex items-center gap-2">
                      <img src={gig.clientProfile?.avatar} alt="" className="w-8 h-8 rounded-full border border-slate-200 bg-slate-50" />
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Client</p>
                        <p className="text-xs font-black text-slate-700">{gig.clientProfile?.name}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-400 uppercase">Budget</p>
                      <p className="text-base font-black text-emerald-600">${gig.budget} <span className="text-[10px] text-emerald-600/70">USDC</span></p>
                    </div>
                  </div>

                  {/* Actions (Only show in My Gigs or if open) */}
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    {gig.status === 'OPEN' && gig.client_wallet !== userAddress?.toLowerCase() && (
                      <button onClick={() => handleApply(gig.id)} className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black transition-all">
                        Accept Gig
                      </button>
                    )}

                    {gig.status === 'IN_PROGRESS' && gig.client_wallet === userAddress?.toLowerCase() && (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 bg-blue-50 p-2.5 rounded-xl border border-blue-100">
                          <img src={gig.freelancerProfile?.avatar} alt="" className="w-6 h-6 rounded-full bg-white" />
                          <div className="text-[10px] font-bold text-blue-800">
                            Freelancer: <span className="font-black">{gig.freelancerProfile?.name}</span> is working on this.
                          </div>
                        </div>
                        <button onClick={() => handlePayFreelancer(gig)} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-sm shadow-indigo-500/20">
                          <Send size={14} /> Pay & Complete
                        </button>
                      </div>
                    )}

                    {gig.status === 'IN_PROGRESS' && gig.freelancer_wallet === userAddress?.toLowerCase() && (
                      <div className="flex items-center justify-center gap-2 py-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 text-xs font-black">
                        <Clock size={14} /> You are working on this
                      </div>
                    )}

                    {gig.status === 'COMPLETED' && (
                      <div className="flex items-center justify-center gap-2 py-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 text-xs font-black">
                        <CheckCircle2 size={14} /> Payment Completed
                      </div>
                    )}
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
