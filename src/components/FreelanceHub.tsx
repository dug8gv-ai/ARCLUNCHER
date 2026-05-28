'use client';

import { useState, useEffect, useRef } from 'react';
import { useAccount } from 'wagmi';
import { supabase } from '@/lib/supabase';
import { Briefcase, Loader2, Plus, Clock, CheckCircle2, DollarSign, Send, MessageCircle, X, ImagePlus, AlertTriangle } from 'lucide-react';
import { appKitSend, createBrowserAdapter } from '@/lib/appKit';

interface Gig {
  id: string;
  client_wallet: string;
  title: string;
  description: string;
  budget: number;
  image_url: string | null;
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED';
  freelancer_wallet: string | null;
  created_at: string;
  clientProfile?: any;
  freelancerProfile?: any;
  // Proposal gig fields
  is_proposal?: boolean;
  proposal_image1?: string | null;
  proposal_image2?: string | null;
}

interface GigMessage {
  id: string;
  gig_id: string;
  sender_wallet: string;
  message: string;
  created_at: string;
  senderProfile?: any;
}

// Compress image client-side before storing
const compressImage = (file: File, maxWidth = 500, quality = 0.6): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export function FreelanceHub() {
  const { isConnected, address: userAddress, connector } = useAccount();

  const [activeTab, setActiveTab] = useState<'board' | 'my_gigs'>('board');
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Post Gig Modal
  const [isPosting, setIsPosting] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newBudget, setNewBudget] = useState('');
  const [newImage, setNewImage] = useState<string | null>(null);
  const [postLoading, setPostLoading] = useState(false);
  const [isProposal, setIsProposal] = useState(false);
  const [proposalImage1, setProposalImage1] = useState<string | null>(null);
  const [proposalImage2, setProposalImage2] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const proposalRef1 = useRef<HTMLInputElement>(null);
  const proposalRef2 = useRef<HTMLInputElement>(null);

  // Payment Confirmation Modal
  const [payConfirmGig, setPayConfirmGig] = useState<Gig | null>(null);
  const [payLoading, setPayLoading] = useState(false);

  // Chat Modal
  const [chatGig, setChatGig] = useState<Gig | null>(null);
  const [chatMessages, setChatMessages] = useState<GigMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ==================== DATA FETCHING ====================

  const fetchGigs = async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const { data, error } = await supabase
        .from('freelance_gigs')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Supabase error fetching gigs:', error);
        // Table missing — show empty board, not an error wall
        setGigs([]);
        setFetchError(null);
        return;
      }

      if (data) {
        // Fetch profiles for all wallets
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
            pData.forEach(p => { profilesMap[p.wallet] = p; });
          }
        }

        const enriched = data.map(g => ({
          ...g,
          clientProfile: profilesMap[g.client_wallet] || { name: 'Anonymous', avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${g.client_wallet}` },
          freelancerProfile: g.freelancer_wallet
            ? (profilesMap[g.freelancer_wallet] || { name: 'Anonymous', avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${g.freelancer_wallet}` })
            : null
        }));

        setGigs(enriched);
      }
    } catch (err) {
      console.error('Error fetching gigs:', err);
      setFetchError('Could not load gigs. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const fetchChatMessages = async (gigId: string) => {
    try {
      setChatLoading(true);
      const { data, error } = await supabase
        .from('gig_messages')
        .select('*')
        .eq('gig_id', gigId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching chat:', error);
        setChatMessages([]);
        return;
      }

      if (data) {
        // Fetch sender profiles
        const wallets = new Set<string>();
        data.forEach(m => wallets.add(m.sender_wallet));

        let profilesMap: Record<string, any> = {};
        if (wallets.size > 0) {
          const { data: pData } = await supabase.from('profiles').select('*').in('wallet', Array.from(wallets));
          if (pData) { pData.forEach(p => { profilesMap[p.wallet] = p; }); }
        }

        const enriched = data.map(m => ({
          ...m,
          senderProfile: profilesMap[m.sender_wallet] || { name: 'Anonymous', avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${m.sender_wallet}` }
        }));

        setChatMessages(enriched);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setChatLoading(false);
    }
  };

  useEffect(() => { fetchGigs(); }, []);

  // Real-time chat subscription
  useEffect(() => {
    if (!chatGig) return;

    fetchChatMessages(chatGig.id);

    const channel = supabase
      .channel(`gig_chat_${chatGig.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'gig_messages',
        filter: `gig_id=eq.${chatGig.id}`
      }, async () => {
        // Refetch on new message
        await fetchChatMessages(chatGig.id);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [chatGig]);

  // Auto scroll chat to bottom
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  // ==================== HANDLERS ====================

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setNewImage(compressed);
    } catch (err) {
      console.error('Image compression failed:', err);
    }
  };

  const handlePostGig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userAddress) return alert('Please connect wallet first.');
    if (!newTitle || !newDesc || !newBudget) return;

    try {
      setPostLoading(true);
      const { error } = await supabase.from('freelance_gigs').insert({
        client_wallet: userAddress.toLowerCase(),
        title: newTitle,
        description: newDesc,
        budget: Number(newBudget),
        image_url: newImage || null,
        status: 'OPEN',
        is_proposal: isProposal,
        proposal_image1: isProposal ? (proposalImage1 || null) : null,
        proposal_image2: isProposal ? (proposalImage2 || null) : null,
      });

      if (error) {
        console.error('Insert error:', error);
        alert('Failed to post gig: ' + error.message);
        return;
      }

      setIsPosting(false);
      setNewTitle('');
      setNewDesc('');
      setNewBudget('');
      setNewImage(null);
      setIsProposal(false);
      setProposalImage1(null);
      setProposalImage2(null);
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
        .update({ status: 'IN_PROGRESS', freelancer_wallet: userAddress.toLowerCase() })
        .eq('id', gigId);
      fetchGigs();
    } catch (err) {
      console.error(err);
    }
  };

  const handlePayFreelancer = async () => {
    if (!payConfirmGig || !userAddress || !payConfirmGig.freelancer_wallet) return;

    try {
      setPayLoading(true);
      let provider = typeof window !== 'undefined' && (window as any).ethereum ? (window as any).ethereum : await connector?.getProvider();
      if (!provider) throw new Error("No Web3 Provider available");
      const adapter = createBrowserAdapter(provider);
      await appKitSend(adapter, String(payConfirmGig.budget), "USDC", payConfirmGig.freelancer_wallet, "Arc_Testnet");

      await supabase
        .from('freelance_gigs')
        .update({ status: 'COMPLETED' })
        .eq('id', payConfirmGig.id);

      setPayConfirmGig(null);
      fetchGigs();
    } catch (err: any) {
      console.error(err);
      alert('Payment failed: ' + (err.message || 'Unknown error'));
    } finally {
      setPayLoading(false);
    }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatGig || !userAddress || !chatInput.trim()) return;

    try {
      setChatSending(true);
      await supabase.from('gig_messages').insert({
        gig_id: chatGig.id,
        sender_wallet: userAddress.toLowerCase(),
        message: chatInput.trim()
      });
      setChatInput('');
    } catch (err) {
      console.error(err);
    } finally {
      setChatSending(false);
    }
  };

  // ==================== FILTERED DATA ====================

  const filteredGigs = activeTab === 'board'
    ? gigs // Show ALL gigs on the board
    : gigs.filter(g => g.client_wallet === userAddress?.toLowerCase() || g.freelancer_wallet === userAddress?.toLowerCase());

  // ==================== RENDER ====================

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200/80 rounded-[32px] p-6 sm:p-8 shadow-sm">

        {/* Header & Tabs */}
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
              <button onClick={() => setActiveTab('board')} className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${activeTab === 'board' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                Gigs Board
              </button>
              <button onClick={() => setActiveTab('my_gigs')} className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${activeTab === 'my_gigs' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                My Gigs
              </button>
            </div>
            <button onClick={() => setIsPosting(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 sm:px-4 sm:py-2 rounded-xl text-xs font-black transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-1.5">
              <Plus size={16} /> <span className="hidden sm:inline">Post Gig</span>
            </button>
          </div>
        </div>

        {/* Error State */}
        {fetchError && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-bold text-amber-700">{fetchError}</p>
              <p className="text-[10px] text-amber-500 mt-1">Run the SQL in your Supabase Dashboard → SQL Editor to create the required tables.</p>
            </div>
          </div>
        )}

        {/* ==================== POST GIG MODAL ==================== */}
        {isPosting && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black text-slate-800">Post a New Gig</h3>
                <button onClick={() => { setIsPosting(false); setNewImage(null); setIsProposal(false); setProposalImage1(null); setProposalImage2(null); }} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100">
                  <X size={18} />
                </button>
              </div>
              <form onSubmit={handlePostGig} className="space-y-4">

                {/* Cover Image */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Gig Cover Image (Optional)</label>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
                  {newImage ? (
                    <div className="relative rounded-xl overflow-hidden border border-slate-200">
                      <img src={newImage} alt="Preview" className="w-full h-36 object-cover" />
                      <button type="button" onClick={() => { setNewImage(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="absolute top-2 right-2 bg-white/90 hover:bg-white text-slate-600 p-1.5 rounded-full shadow-sm"><X size={14} /></button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full h-28 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-indigo-300 hover:text-indigo-500 transition-all hover:bg-indigo-50/30">
                      <ImagePlus size={22} /><span className="text-[10px] font-bold uppercase tracking-wider">Click to upload</span>
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Job Title</label>
                  <input required value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="e.g. Design a logo for Arc" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Description</label>
                  <textarea required value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Details of the job..." className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-indigo-500 min-h-[90px]" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Budget (USDC)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input required type="number" min="1" value={newBudget} onChange={e => setNewBudget(e.target.value)} placeholder="50" className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black outline-none focus:border-indigo-500" />
                  </div>
                </div>

                {/* Proposal Samples Toggle */}
                <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50">
                  <div className="flex items-center justify-between cursor-pointer" onClick={() => { setIsProposal(!isProposal); setProposalImage1(null); setProposalImage2(null); }}>
                    <div>
                      <p className="text-xs font-black text-slate-700">Add Proposal Samples</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Attach up to 2 portfolio images to showcase your work</p>
                    </div>
                    <div className={`relative w-11 h-6 rounded-full transition-all flex-shrink-0 ${isProposal ? 'bg-indigo-600' : 'bg-slate-300'}`}>
                      <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${isProposal ? 'left-5' : 'left-0.5'}`} />
                    </div>
                  </div>
                  {isProposal && (
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Sample 1</p>
                        <input ref={proposalRef1} type="file" accept="image/*" onChange={async e => { const f = e.target.files?.[0]; if (f) setProposalImage1(await compressImage(f)); }} className="hidden" />
                        {proposalImage1 ? (
                          <div className="relative rounded-xl overflow-hidden border border-slate-200 h-28">
                            <img src={proposalImage1} alt="P1" className="w-full h-full object-cover" />
                            <button type="button" onClick={() => { setProposalImage1(null); if (proposalRef1.current) proposalRef1.current.value = ''; }} className="absolute top-1 right-1 bg-white/90 text-slate-600 p-1 rounded-full shadow-sm"><X size={12} /></button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => proposalRef1.current?.click()} className="w-full h-28 border-2 border-dashed border-indigo-200 rounded-xl flex flex-col items-center justify-center gap-1.5 text-indigo-400 hover:bg-indigo-50/50 transition-all">
                            <ImagePlus size={20} /><span className="text-[9px] font-bold uppercase">Upload</span>
                          </button>
                        )}
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1.5">Sample 2</p>
                        <input ref={proposalRef2} type="file" accept="image/*" onChange={async e => { const f = e.target.files?.[0]; if (f) setProposalImage2(await compressImage(f)); }} className="hidden" />
                        {proposalImage2 ? (
                          <div className="relative rounded-xl overflow-hidden border border-slate-200 h-28">
                            <img src={proposalImage2} alt="P2" className="w-full h-full object-cover" />
                            <button type="button" onClick={() => { setProposalImage2(null); if (proposalRef2.current) proposalRef2.current.value = ''; }} className="absolute top-1 right-1 bg-white/90 text-slate-600 p-1 rounded-full shadow-sm"><X size={12} /></button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => proposalRef2.current?.click()} className="w-full h-28 border-2 border-dashed border-indigo-200 rounded-xl flex flex-col items-center justify-center gap-1.5 text-indigo-400 hover:bg-indigo-50/50 transition-all">
                            <ImagePlus size={20} /><span className="text-[9px] font-bold uppercase">Upload</span>
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => { setIsPosting(false); setNewImage(null); setIsProposal(false); setProposalImage1(null); setProposalImage2(null); }} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black">Cancel</button>
                  <button type="submit" disabled={postLoading} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 disabled:opacity-50">
                    {postLoading ? <Loader2 className="animate-spin size-4" /> : 'Post Gig'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ==================== PAYMENT CONFIRMATION MODAL ==================== */}
        {payConfirmGig && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="text-center mb-5">
                <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto mb-3">
                  <DollarSign size={28} className="text-emerald-600" />
                </div>
                <h3 className="text-lg font-black text-slate-800">Confirm Payment</h3>
                <p className="text-xs text-slate-500 mt-1">You are about to release funds to the freelancer.</p>
              </div>

              <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-2xl p-4 mb-5">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Gig</span>
                  <span className="text-xs font-black text-slate-700 text-right max-w-[200px] truncate">{payConfirmGig.title}</span>
                </div>
                <div className="w-full h-px bg-slate-200" />
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Amount</span>
                  <span className="text-base font-black text-emerald-600">${payConfirmGig.budget} USDC</span>
                </div>
                <div className="w-full h-px bg-slate-200" />
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Freelancer</span>
                  <div className="flex items-center gap-2">
                    <img src={payConfirmGig.freelancerProfile?.avatar} alt="" className="w-6 h-6 rounded-full border border-slate-200" />
                    <span className="text-xs font-black text-slate-700">{payConfirmGig.freelancerProfile?.name}</span>
                  </div>
                </div>
                <div className="w-full h-px bg-slate-200" />
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">To Wallet</span>
                  <span className="text-[10px] font-mono text-slate-500">{payConfirmGig.freelancer_wallet?.slice(0, 8)}...{payConfirmGig.freelancer_wallet?.slice(-6)}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setPayConfirmGig(null)} disabled={payLoading} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-black disabled:opacity-50">Cancel</button>
                <button onClick={handlePayFreelancer} disabled={payLoading} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-emerald-500/20">
                  {payLoading ? <Loader2 className="animate-spin size-4" /> : <><Send size={14} /> Pay Now</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================== CHAT MODAL ==================== */}
        {chatGig && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-0 sm:p-4">
            <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg shadow-2xl animate-in slide-in-from-bottom duration-200 flex flex-col h-[85vh] sm:h-[70vh]">

              {/* Chat Header */}
              <div className="flex items-center justify-between p-4 border-b border-slate-100 flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center border border-indigo-100">
                    <MessageCircle size={18} className="text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800 leading-tight max-w-[200px] truncate">{chatGig.title}</h3>
                    <p className="text-[10px] text-slate-400 font-bold">${chatGig.budget} USDC • {chatGig.status.replace('_', ' ')}</p>
                  </div>
                </div>
                <button onClick={() => { setChatGig(null); setChatMessages([]); }} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-100">
                  <X size={18} />
                </button>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                {chatLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="animate-spin size-6 text-indigo-500" />
                  </div>
                ) : chatMessages.length === 0 ? (
                  <div className="text-center py-10">
                    <MessageCircle size={28} className="text-slate-200 mx-auto mb-2" />
                    <p className="text-xs text-slate-400 font-bold">No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  chatMessages.map(msg => {
                    const isMe = msg.sender_wallet === userAddress?.toLowerCase();
                    return (
                      <div key={msg.id} className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                        <img src={msg.senderProfile?.avatar} alt="" className="w-8 h-8 rounded-full border border-slate-200 flex-shrink-0 mt-1" />
                        <div className={`max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                          <p className={`text-[10px] font-bold mb-0.5 ${isMe ? 'text-right text-indigo-500' : 'text-left text-slate-400'}`}>
                            {msg.senderProfile?.name}
                          </p>
                          <div className={`px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${isMe ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-slate-100 text-slate-700 rounded-tl-sm'}`}>
                            {msg.message}
                          </div>
                          <p className={`text-[9px] text-slate-300 mt-0.5 ${isMe ? 'text-right' : 'text-left'}`}>
                            {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSendChat} className="p-3 border-t border-slate-100 flex gap-2 flex-shrink-0">
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500"
                />
                <button type="submit" disabled={chatSending || !chatInput.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-xl disabled:opacity-40 transition-all">
                  {chatSending ? <Loader2 className="animate-spin size-4" /> : <Send size={16} />}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ==================== GIGS LIST ==================== */}
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
                <div key={gig.id} className="border border-slate-200 rounded-2xl bg-white hover:shadow-md transition-all flex flex-col h-full relative overflow-hidden group">

                  {/* Gig Image */}
                  {gig.image_url && (
                    <div className="w-full h-40 bg-slate-100 overflow-hidden">
                      <img src={gig.image_url} alt={gig.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    </div>
                  )}

                  {/* Proposal Sample Images */}
                  {gig.is_proposal && (gig.proposal_image1 || gig.proposal_image2) && (
                    <div className={`grid gap-0.5 ${gig.proposal_image1 && gig.proposal_image2 ? 'grid-cols-2' : 'grid-cols-1'} ${gig.image_url ? '' : 'mt-0'}`}>
                      {gig.proposal_image1 && (
                        <div className="h-28 bg-slate-100 overflow-hidden">
                          <img src={gig.proposal_image1} alt="Sample 1" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        </div>
                      )}
                      {gig.proposal_image2 && (
                        <div className="h-28 bg-slate-100 overflow-hidden">
                          <img src={gig.proposal_image2} alt="Sample 2" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                        </div>
                      )}
                    </div>
                  )}

                  <div className="p-5 flex flex-col flex-1">
                    {/* Status Badge */}
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-lg font-black text-slate-800 leading-tight pr-4 flex-1">{gig.title}</h3>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        {gig.is_proposal && (
                          <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-lg bg-indigo-100 text-indigo-600">Proposal</span>
                        )}
                        <span className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-lg ${
                          gig.status === 'OPEN' ? 'bg-emerald-100 text-emerald-600' :
                          gig.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-600' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          {gig.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 mb-4 flex-1 leading-relaxed">{gig.description}</p>

                    {/* Client & Budget Row */}
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

                    {/* Actions Row */}
                    <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">

                      {/* Accept Gig (for non-owners when OPEN) */}
                      {gig.status === 'OPEN' && gig.client_wallet !== userAddress?.toLowerCase() && (
                        <button onClick={() => handleApply(gig.id)} className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black transition-all">
                          Accept Gig
                        </button>
                      )}

                      {/* Pay Freelancer (for client when IN_PROGRESS) */}
                      {gig.status === 'IN_PROGRESS' && gig.client_wallet === userAddress?.toLowerCase() && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 bg-blue-50 p-2.5 rounded-xl border border-blue-100">
                            <img src={gig.freelancerProfile?.avatar} alt="" className="w-6 h-6 rounded-full bg-white" />
                            <div className="text-[10px] font-bold text-blue-800">
                              Freelancer: <span className="font-black">{gig.freelancerProfile?.name}</span> is working on this.
                            </div>
                          </div>
                          <button onClick={() => setPayConfirmGig(gig)} className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-sm shadow-emerald-500/20">
                            <Send size={14} /> Pay & Complete
                          </button>
                        </div>
                      )}

                      {/* Working indicator (for freelancer) */}
                      {gig.status === 'IN_PROGRESS' && gig.freelancer_wallet === userAddress?.toLowerCase() && (
                        <div className="flex items-center justify-center gap-2 py-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 text-xs font-black">
                          <Clock size={14} /> You are working on this
                        </div>
                      )}

                      {/* Completed */}
                      {gig.status === 'COMPLETED' && (
                        <div className="flex items-center justify-center gap-2 py-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 text-xs font-black">
                          <CheckCircle2 size={14} /> Payment Completed
                        </div>
                      )}

                      {/* Chat Button — always visible */}
                      <button onClick={() => setChatGig(gig)} className="w-full py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 border border-slate-200">
                        <MessageCircle size={14} /> Open Chat
                      </button>
                    </div>
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
