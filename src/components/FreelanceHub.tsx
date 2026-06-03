'use client';

import { useState, useEffect, useRef } from 'react';
import { useAccount, useWriteContract, usePublicClient } from 'wagmi';
import { parseUnits, erc20Abi } from 'viem';
import { supabase } from '@/lib/supabase';
import { Briefcase, Loader2, Plus, Clock, CheckCircle2, DollarSign, Send, MessageCircle, X, ImagePlus, AlertTriangle, Trash2, Bell } from 'lucide-react';
import toast from 'react-hot-toast';

const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS || '0x3600000000000000000000000000000000000000';

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

const compressImage = (file: File, maxWidth = 500, quality = 0.6): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > maxWidth) { height = (height * maxWidth) / width; width = maxWidth; }
        canvas.width = width; canvas.height = height;
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height);
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
  const { isConnected, address: userAddress } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [activeTab, setActiveTab] = useState<'board' | 'my_gigs'>('board');
  const [gigs, setGigs] = useState<Gig[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Post Gig
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

  // Delete
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

  // Payment
  const [payConfirmGig, setPayConfirmGig] = useState<Gig | null>(null);
  const [payLoading, setPayLoading] = useState(false);
  // Direct payment from chat (any user can pay gig owner)
  const [directPayTarget, setDirectPayTarget] = useState<{ wallet: string; name: string; avatar: string } | null>(null);
  const [directPayAmount, setDirectPayAmount] = useState('');
  const [directPayLoading, setDirectPayLoading] = useState(false);

  // Chat
  const [chatGig, setChatGig] = useState<Gig | null>(null);
  const [chatMessages, setChatMessages] = useState<GigMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Unread notifications (new messages on user's gigs)
  const [unreadCount, setUnreadCount] = useState(0);

  // Profile modal
  const [profileModal, setProfileModal] = useState<any | null>(null);

  // ==================== DATA FETCHING ====================

  const fetchGigs = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('freelance_gigs').select('*').order('created_at', { ascending: false });
      if (error) { setGigs([]); return; }
      if (data) {
        const wallets = new Set<string>();
        data.forEach(g => { wallets.add(g.client_wallet); if (g.freelancer_wallet) wallets.add(g.freelancer_wallet); });
        let profilesMap: Record<string, any> = {};
        if (wallets.size > 0) {
          const { data: pData } = await supabase.from('profiles').select('*').in('wallet', Array.from(wallets));
          if (pData) pData.forEach(p => { profilesMap[p.wallet] = p; });
        }
        const enriched = data.map(g => ({
          ...g,
          clientProfile: profilesMap[g.client_wallet] || { name: g.client_wallet.slice(0, 6) + '...' + g.client_wallet.slice(-4), avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${g.client_wallet}` },
          freelancerProfile: g.freelancer_wallet ? (profilesMap[g.freelancer_wallet] || { name: g.freelancer_wallet.slice(0, 6) + '...' + g.freelancer_wallet.slice(-4), avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${g.freelancer_wallet}` }) : null
        }));
        setGigs(enriched);
      }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  };

  const fetchChatMessages = async (gigId: string) => {
    try {
      setChatLoading(true);
      const { data, error } = await supabase.from('gig_messages').select('*').eq('gig_id', gigId).order('created_at', { ascending: true });
      if (error) { setChatMessages([]); return; }
      if (data) {
        const wallets = new Set<string>();
        data.forEach(m => wallets.add(m.sender_wallet));
        let profilesMap: Record<string, any> = {};
        if (wallets.size > 0) {
          const { data: pData } = await supabase.from('profiles').select('*').in('wallet', Array.from(wallets));
          if (pData) pData.forEach(p => { profilesMap[p.wallet] = p; });
        }
        setChatMessages(data.map(m => ({ ...m, senderProfile: profilesMap[m.sender_wallet] || { name: m.sender_wallet.slice(0, 6) + '...' + m.sender_wallet.slice(-4), avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${m.sender_wallet}` } })));
      }
    } catch (err) { console.error(err); } finally { setChatLoading(false); }
  };

  // Count unread messages on user's gigs
  const fetchUnread = async () => {
    if (!userAddress) return;
    const myGigs = gigs.filter(g => g.client_wallet === userAddress.toLowerCase());
    if (myGigs.length === 0) return;
    const lastSeen = Number(localStorage.getItem(`arc_gig_last_seen_${userAddress}`) || 0);
    const { data } = await supabase.from('gig_messages').select('id').in('gig_id', myGigs.map(g => g.id)).neq('sender_wallet', userAddress.toLowerCase()).gt('created_at', new Date(lastSeen).toISOString());
    setUnreadCount(data?.length || 0);
  };

  useEffect(() => { fetchGigs(); }, []);
  useEffect(() => { if (gigs.length > 0) fetchUnread(); }, [gigs, userAddress]);

  // Real-time chat
  useEffect(() => {
    if (!chatGig) return;
    fetchChatMessages(chatGig.id);
    const channel = supabase.channel(`gig_chat_${chatGig.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'gig_messages', filter: `gig_id=eq.${chatGig.id}` }, async () => { await fetchChatMessages(chatGig.id); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [chatGig]);

  // Real-time new message notifications for gig owner
  useEffect(() => {
    if (!userAddress || gigs.length === 0) return;
    const myGigIds = gigs.filter(g => g.client_wallet === userAddress.toLowerCase()).map(g => g.id);
    if (myGigIds.length === 0) return;
    const channel = supabase.channel(`gig_owner_notif_${userAddress}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'gig_messages' }, (payload) => {
        const msg = payload.new as any;
        if (myGigIds.includes(msg.gig_id) && msg.sender_wallet !== userAddress.toLowerCase()) {
          setUnreadCount(c => c + 1);
        }
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [gigs, userAddress]);

  useEffect(() => { if (chatEndRef.current) chatEndRef.current.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  // ==================== HANDLERS ====================

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try { setNewImage(await compressImage(file)); } catch (err) { console.error(err); }
  };

  const handlePostGig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userAddress) return toast.error('Please connect wallet first.');
    try {
      setPostLoading(true);
      const { error } = await supabase.from('freelance_gigs').insert({
        client_wallet: userAddress.toLowerCase(), title: newTitle, description: newDesc,
        budget: Number(newBudget), image_url: newImage || null, status: 'OPEN',
        is_proposal: isProposal,
        proposal_image1: isProposal ? (proposalImage1 || null) : null,
        proposal_image2: isProposal ? (proposalImage2 || null) : null,
      });
      if (error) { toast.error('Failed to post gig: ' + error.message); return; }
      setIsPosting(false); setNewTitle(''); setNewDesc(''); setNewBudget('');
      setNewImage(null); setIsProposal(false); setProposalImage1(null); setProposalImage2(null);
      fetchGigs();
    } catch (err) { console.error(err); } finally { setPostLoading(false); }
  };

  const handleDeleteGig = async (gig: Gig) => {
    if (!userAddress || gig.client_wallet !== userAddress.toLowerCase()) return;
    // 1-week delete limit: check localStorage
    const key = `arc_gig_deleted_${userAddress}`;
    const lastDelete = Number(localStorage.getItem(key) || 0);
    const oneWeek = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - lastDelete < oneWeek) {
      const daysLeft = Math.ceil((oneWeek - (Date.now() - lastDelete)) / (24 * 60 * 60 * 1000));
      toast.error(`You can only delete 1 gig per week. Try again in ${daysLeft} day(s).`);
      return;
    }
    if (!confirm(`Delete "${gig.title}"? This cannot be undone.`)) return;
    try {
      setDeleteLoading(gig.id);
      await supabase.from('gig_messages').delete().eq('gig_id', gig.id);
      const { error } = await supabase.from('freelance_gigs').delete().eq('id', gig.id);
      if (error) { toast.error('Delete failed: ' + error.message); return; }
      localStorage.setItem(key, String(Date.now()));
      fetchGigs();
    } catch (err) { console.error(err); } finally { setDeleteLoading(null); }
  };

  const handleApply = async (gigId: string) => {
    if (!userAddress) return toast.error('Please connect wallet.');
    await supabase.from('freelance_gigs').update({ status: 'IN_PROGRESS', freelancer_wallet: userAddress.toLowerCase() }).eq('id', gigId);
    fetchGigs();
  };

  const handlePayFreelancer = async () => {
    if (!payConfirmGig || !userAddress || !payConfirmGig.freelancer_wallet) return;
    try {
      setPayLoading(true);
      // Direct ERC20 USDC transfer — no Circle AppKit needed
      const amountWei = parseUnits(String(payConfirmGig.budget), 6); // USDC = 6 decimals
      const txHash = await writeContractAsync({
        address: USDC_ADDRESS as `0x${string}`,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [payConfirmGig.freelancer_wallet as `0x${string}`, amountWei],
      });
      await publicClient?.waitForTransactionReceipt({ hash: txHash });
      await supabase.from('freelance_gigs').update({ status: 'COMPLETED' }).eq('id', payConfirmGig.id);
      setPayConfirmGig(null);
      fetchGigs();
    } catch (err: any) {
      toast.error('Payment failed: ' + (err.shortMessage || err.message || 'Unknown error'));
    } finally { setPayLoading(false); }
  };

  const handleDirectPay = async () => {
    if (!directPayTarget || !userAddress || !directPayAmount) return;
    try {
      setDirectPayLoading(true);
      // Direct ERC20 USDC transfer
      const amountWei = parseUnits(directPayAmount, 6); // USDC = 6 decimals
      const txHash = await writeContractAsync({
        address: USDC_ADDRESS as `0x${string}`,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [directPayTarget.wallet as `0x${string}`, amountWei],
      });
      await publicClient?.waitForTransactionReceipt({ hash: txHash });
      toast.success(`✓ Sent ${directPayAmount} USDC to ${directPayTarget.name}`);
      setDirectPayTarget(null);
      setDirectPayAmount('');
    } catch (err: any) {
      toast.error('Payment failed: ' + (err.shortMessage || err.message || 'Unknown error'));
    } finally { setDirectPayLoading(false); }
  };

  const handleSendChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatGig || !userAddress || !chatInput.trim()) return;
    try {
      setChatSending(true);
      const { error } = await supabase.from('gig_messages').insert({
        gig_id: chatGig.id,
        sender_wallet: userAddress.toLowerCase(),
        message: chatInput.trim()
      });
      if (error) {
        console.error('Chat insert error:', error);
        toast.error('Message failed: ' + error.message + '\n\nFix: Run this SQL in Supabase:\nALTER TABLE gig_messages DISABLE ROW LEVEL SECURITY;');
        return;
      }
      setChatInput('');
      // Immediately refetch so message appears without waiting for realtime
      await fetchChatMessages(chatGig.id);
    } catch (err: any) {
      console.error(err);
      toast.error('Message failed: ' + (err.message || 'Unknown error'));
    } finally { setChatSending(false); }
  };

  const openChat = (gig: Gig) => {
    setChatGig(gig);
    // Mark as seen
    if (userAddress) localStorage.setItem(`arc_gig_last_seen_${userAddress}`, String(Date.now()));
    setUnreadCount(0);
  };

  const filteredGigs = activeTab === 'board' ? gigs : gigs.filter(g => g.client_wallet === userAddress?.toLowerCase() || g.freelancer_wallet === userAddress?.toLowerCase());

  // ==================== RENDER ====================
  return (
    <div className="space-y-6">
      <div className="card rounded-[32px] p-6 sm:p-8 shadow-sm">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border-dim)] pb-5 mb-6">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center border border-indigo-100 text-indigo-600">
              <Briefcase size={22} />
            </div>
            <div>
              <h2 className="text-xl font-black text-[var(--text-primary)]">Arc Freelance Hub</h2>
              <p className="text-xs text-[var(--text-secondary)] font-semibold">Post crypto gigs or apply to earn USDC.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-slate-100 p-1 rounded-xl">
              <button onClick={() => setActiveTab('board')} className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${activeTab === 'board' ? 'bg-[var(--bg-card)] text-indigo-600 shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>Gigs Board</button>
              <button onClick={() => setActiveTab('my_gigs')} className={`relative px-4 py-2 rounded-lg text-xs font-black transition-all ${activeTab === 'my_gigs' ? 'bg-[var(--bg-card)] text-indigo-600 shadow-sm' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'}`}>
                My Gigs
                {unreadCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">{unreadCount}</span>}
              </button>
            </div>
            <button onClick={() => setIsPosting(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white p-2 sm:px-4 sm:py-2 rounded-xl text-xs font-black transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-1.5">
              <Plus size={16} /><span className="hidden sm:inline">Post Gig</span>
            </button>
          </div>
        </div>

        {fetchError && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs font-bold text-amber-700">{fetchError}</p>
          </div>
        )}

        {/* POST GIG MODAL */}
        {isPosting && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <div className="card rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black text-[var(--text-primary)]">Post a New Gig</h3>
                <button onClick={() => { setIsPosting(false); setNewImage(null); setIsProposal(false); setProposalImage1(null); setProposalImage2(null); }} className="text-[var(--text-secondary)] hover:text-[var(--text-secondary)] p-1.5 rounded-full hover:bg-slate-100"><X size={18} /></button>
              </div>
              <form onSubmit={handlePostGig} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">Cover Image (Optional)</label>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
                  {newImage ? (
                    <div className="relative rounded-xl overflow-hidden border border-[var(--border-dim)]">
                      <img src={newImage} alt="Preview" className="w-full h-36 object-cover" />
                      <button type="button" onClick={() => { setNewImage(null); if (fileInputRef.current) fileInputRef.current.value = ''; }} className="absolute top-2 right-2 bg-[var(--bg-card)]/90 text-[var(--text-secondary)] p-1.5 rounded-full shadow-sm"><X size={14} /></button>
                    </div>
                  ) : (
                    <button type="button" onClick={() => fileInputRef.current?.click()} className="w-full h-28 border-2 border-dashed border-[var(--border-dim)] rounded-xl flex flex-col items-center justify-center gap-2 text-[var(--text-secondary)] hover:border-indigo-300 hover:text-indigo-500 transition-all hover:bg-indigo-50/30">
                      <ImagePlus size={22} /><span className="text-[10px] font-bold uppercase tracking-wider">Click to upload</span>
                    </button>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">Job Title</label>
                  <input required value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="e.g. Design a logo for Arc" className="w-full px-4 py-3 bg-slate-50 border border-[var(--border-dim)] rounded-xl text-sm outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">Description</label>
                  <textarea required value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Details of the job..." className="w-full px-4 py-3 bg-slate-50 border border-[var(--border-dim)] rounded-xl text-sm outline-none focus:border-indigo-500 min-h-[90px]" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">Budget (USDC)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={16} />
                    <input required type="number" min="1" value={newBudget} onChange={e => setNewBudget(e.target.value)} placeholder="50" className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-[var(--border-dim)] rounded-xl text-sm font-black outline-none focus:border-indigo-500" />
                  </div>
                </div>
                <div className="border border-[var(--border-dim)] rounded-2xl p-4 bg-slate-50/50">
                  <div className="flex items-center justify-between cursor-pointer" onClick={() => { setIsProposal(!isProposal); setProposalImage1(null); setProposalImage2(null); }}>
                    <div><p className="text-xs font-black text-[var(--text-primary)]">Add Proposal Samples</p><p className="text-[10px] text-[var(--text-secondary)] mt-0.5">Attach up to 2 portfolio images</p></div>
                    <div className={`relative w-11 h-6 rounded-full transition-all flex-shrink-0 ${isProposal ? 'bg-indigo-600' : 'bg-slate-300'}`}><div className={`absolute top-0.5 w-5 h-5 card rounded-full shadow transition-all ${isProposal ? 'left-5' : 'left-0.5'}`} /></div>
                  </div>
                  {isProposal && (
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      {[{ ref: proposalRef1, img: proposalImage1, set: setProposalImage1, label: 'Sample 1' }, { ref: proposalRef2, img: proposalImage2, set: setProposalImage2, label: 'Sample 2' }].map((item, i) => (
                        <div key={i}>
                          <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase mb-1.5">{item.label}</p>
                          <input ref={item.ref} type="file" accept="image/*" onChange={async e => { const f = e.target.files?.[0]; if (f) item.set(await compressImage(f)); }} className="hidden" />
                          {item.img ? (
                            <div className="relative rounded-xl overflow-hidden border border-[var(--border-dim)] h-28">
                              <img src={item.img} alt={item.label} className="w-full h-full object-contain p-0.5" />
                              <button type="button" onClick={() => { item.set(null); if (item.ref.current) item.ref.current.value = ''; }} className="absolute top-1 right-1 bg-[var(--bg-card)]/90 text-[var(--text-secondary)] p-1 rounded-full shadow-sm"><X size={12} /></button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => item.ref.current?.click()} className="w-full h-28 border-2 border-dashed border-indigo-200 rounded-xl flex flex-col items-center justify-center gap-1.5 text-indigo-400 hover:bg-indigo-50/50 transition-all">
                              <ImagePlus size={20} /><span className="text-[9px] font-bold uppercase">Upload</span>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => { setIsPosting(false); setNewImage(null); setIsProposal(false); setProposalImage1(null); setProposalImage2(null); }} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-[var(--text-secondary)] rounded-xl text-xs font-black">Cancel</button>
                  <button type="submit" disabled={postLoading} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 disabled:opacity-50">
                    {postLoading ? <Loader2 className="animate-spin size-4" /> : 'Post Gig'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* PAYMENT CONFIRMATION MODAL (for gig completion) */}
        {payConfirmGig && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="card rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="text-center mb-5">
                <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto mb-3"><DollarSign size={28} className="text-emerald-600" /></div>
                <h3 className="text-lg font-black text-[var(--text-primary)]">Confirm Payment</h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1">Release funds to the freelancer.</p>
              </div>
              <div className="space-y-3 bg-slate-50 border border-[var(--border-dim)] rounded-2xl p-4 mb-5 text-xs">
                <div className="flex justify-between"><span className="text-[var(--text-secondary)] font-bold uppercase text-[10px]">Gig</span><span className="font-black text-[var(--text-primary)] truncate max-w-[180px]">{payConfirmGig.title}</span></div>
                <div className="w-full h-px bg-slate-200" />
                <div className="flex justify-between"><span className="text-[var(--text-secondary)] font-bold uppercase text-[10px]">Amount</span><span className="font-black text-emerald-600 text-base">${payConfirmGig.budget} USDC</span></div>
                <div className="w-full h-px bg-slate-200" />
                <div className="flex justify-between items-center"><span className="text-[var(--text-secondary)] font-bold uppercase text-[10px]">To</span>
                  <div className="flex items-center gap-2"><img src={payConfirmGig.freelancerProfile?.avatar} alt="" className="w-6 h-6 rounded-full border border-[var(--border-dim)]" /><span className="font-black text-[var(--text-primary)]">{payConfirmGig.freelancerProfile?.name}</span></div>
                </div>
                <div className="w-full h-px bg-slate-200" />
                <div className="flex justify-between"><span className="text-[var(--text-secondary)] font-bold uppercase text-[10px]">Wallet</span><span className="font-mono text-[var(--text-secondary)] text-[10px]">{payConfirmGig.freelancer_wallet?.slice(0, 8)}...{payConfirmGig.freelancer_wallet?.slice(-6)}</span></div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setPayConfirmGig(null)} disabled={payLoading} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-[var(--text-secondary)] rounded-xl text-xs font-black disabled:opacity-50">Cancel</button>
                <button onClick={handlePayFreelancer} disabled={payLoading} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-emerald-500/20">
                  {payLoading ? <Loader2 className="animate-spin size-4" /> : <><Send size={14} /> Pay Now</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* DIRECT PAYMENT MODAL (from profile/chat) */}
        {directPayTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="card rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-black text-[var(--text-primary)]">Send USDC</h3>
                <button onClick={() => { setDirectPayTarget(null); setDirectPayAmount(''); }} className="text-[var(--text-secondary)] hover:text-[var(--text-secondary)] p-1.5 rounded-full hover:bg-slate-100"><X size={18} /></button>
              </div>
              <div className="flex items-center gap-3 bg-slate-50 border border-[var(--border-dim)] rounded-2xl p-4 mb-4">
                <img src={directPayTarget.avatar} alt="" className="w-12 h-12 rounded-full border-2 border-white shadow" />
                <div><p className="font-black text-[var(--text-primary)]">{directPayTarget.name}</p><p className="text-[10px] font-mono text-[var(--text-secondary)]">{directPayTarget.wallet.slice(0, 10)}...{directPayTarget.wallet.slice(-6)}</p></div>
              </div>
              <div className="mb-4">
                <label className="block text-[10px] font-bold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">Amount (USDC)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={16} />
                  <input type="number" min="0.01" step="0.01" value={directPayAmount} onChange={e => setDirectPayAmount(e.target.value)} placeholder="10.00" className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-[var(--border-dim)] rounded-xl text-sm font-black outline-none focus:border-indigo-500" />
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => { setDirectPayTarget(null); setDirectPayAmount(''); }} className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-[var(--text-secondary)] rounded-xl text-xs font-black">Cancel</button>
                <button onClick={handleDirectPay} disabled={directPayLoading || !directPayAmount} className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-indigo-500/20">
                  {directPayLoading ? <Loader2 className="animate-spin size-4" /> : <><Send size={14} /> Send USDC</>}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PROFILE MODAL */}
        {profileModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div className="card rounded-3xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-black text-[var(--text-primary)]">Profile</h3>
                <button onClick={() => setProfileModal(null)} className="text-[var(--text-secondary)] hover:text-[var(--text-secondary)] p-1.5 rounded-full hover:bg-slate-100"><X size={18} /></button>
              </div>
              <div className="text-center mb-5">
                <img src={profileModal.avatar} alt="" className="w-20 h-20 rounded-full border-4 border-indigo-100 mx-auto mb-3 shadow-lg" />
                <h4 className="text-xl font-black text-[var(--text-primary)]">{profileModal.name}</h4>
                {profileModal.bio && <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">{profileModal.bio}</p>}
                <p className="text-[10px] font-mono text-[var(--text-secondary)] mt-2 bg-slate-50 rounded-lg px-3 py-1.5 inline-block">{profileModal.wallet}</p>
              </div>
              {profileModal.wallet !== userAddress?.toLowerCase() && (
                <button onClick={() => { setProfileModal(null); setDirectPayTarget({ wallet: profileModal.wallet, name: profileModal.name, avatar: profileModal.avatar }); }} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20">
                  <DollarSign size={14} /> Send USDC Payment
                </button>
              )}
            </div>
          </div>
        )}

        {/* CHAT MODAL */}
        {chatGig && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm p-0 sm:p-4">
            <div className="card rounded-t-3xl sm:rounded-3xl w-full sm:max-w-lg shadow-2xl animate-in slide-in-from-bottom duration-200 flex flex-col h-[85vh] sm:h-[75vh]">
              {/* Chat Header */}
              <div className="flex items-center justify-between p-4 border-b border-[var(--border-dim)] flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center border border-indigo-100"><MessageCircle size={18} className="text-indigo-600" /></div>
                  <div>
                    <h3 className="text-sm font-black text-[var(--text-primary)] leading-tight max-w-[200px] truncate">{chatGig.title}</h3>
                    <p className="text-[10px] text-[var(--text-secondary)] font-bold">${chatGig.budget} USDC • {chatGig.status.replace('_', ' ')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {/* Pay gig owner button in chat */}
                  {chatGig.client_wallet !== userAddress?.toLowerCase() && (
                    <button onClick={() => { setChatGig(null); setDirectPayTarget({ wallet: chatGig.client_wallet, name: chatGig.clientProfile?.name || 'Owner', avatar: chatGig.clientProfile?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${chatGig.client_wallet}` }); }} className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-xl text-[10px] font-black flex items-center gap-1 border border-emerald-200 transition-all">
                      <DollarSign size={12} /> Pay
                    </button>
                  )}
                  <button onClick={() => { setChatGig(null); setChatMessages([]); }} className="text-[var(--text-secondary)] hover:text-[var(--text-secondary)] p-2 rounded-full hover:bg-slate-100"><X size={18} /></button>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
                {chatLoading ? (
                  <div className="flex items-center justify-center py-10"><Loader2 className="animate-spin size-6 text-indigo-500" /></div>
                ) : chatMessages.length === 0 ? (
                  <div className="text-center py-10"><MessageCircle size={28} className="text-slate-200 mx-auto mb-2" /><p className="text-xs text-[var(--text-secondary)] font-bold">No messages yet. Start the conversation!</p></div>
                ) : (
                  chatMessages.map(msg => {
                    const isMe = msg.sender_wallet === userAddress?.toLowerCase();
                    return (
                      <div key={msg.id} className={`flex gap-2.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                        <button onClick={() => setProfileModal({ ...msg.senderProfile, wallet: msg.sender_wallet })} className="flex-shrink-0 mt-1 hover:opacity-80 transition-opacity">
                          <img src={msg.senderProfile?.avatar} alt="" className="w-8 h-8 rounded-full border border-[var(--border-dim)]" />
                        </button>
                        <div className={`max-w-[75%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                          <button onClick={() => setProfileModal({ ...msg.senderProfile, wallet: msg.sender_wallet })} className={`text-[10px] font-bold mb-0.5 hover:underline ${isMe ? 'text-indigo-500' : 'text-[var(--text-secondary)]'}`}>
                            {msg.senderProfile?.name}
                          </button>
                          <div className={`px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${isMe ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-slate-100 text-[var(--text-primary)] rounded-tl-sm'}`}>
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
              <form onSubmit={handleSendChat} className="p-3 border-t border-[var(--border-dim)] flex gap-2 flex-shrink-0">
                <input value={chatInput} onChange={e => setChatInput(e.target.value)} placeholder="Type a message..." className="flex-1 px-4 py-2.5 bg-slate-50 border border-[var(--border-dim)] rounded-xl text-xs outline-none focus:border-indigo-500" />
                <button type="submit" disabled={chatSending || !chatInput.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-xl disabled:opacity-40 transition-all">
                  {chatSending ? <Loader2 className="animate-spin size-4" /> : <Send size={16} />}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* GIGS LIST */}
        <div className="space-y-4">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center text-[var(--text-secondary)] gap-3">
              <Loader2 className="animate-spin size-8 text-indigo-500" />
              <p className="text-xs font-bold uppercase tracking-widest">Loading Gigs...</p>
            </div>
          ) : filteredGigs.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-3"><Briefcase size={24} className="text-slate-300" /></div>
              <h3 className="text-base font-black text-[var(--text-primary)]">No Gigs Found</h3>
              <p className="text-xs text-[var(--text-secondary)] font-semibold mt-1">Check back later or post a new gig!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredGigs.map(gig => (
                <div key={gig.id} className="border border-[var(--border-dim)] rounded-2xl bg-[var(--bg-card)] hover:shadow-md transition-all flex flex-col h-full relative overflow-hidden group">

                  {/* Cover Image */}
                  {gig.image_url && (
                    <div className="w-full h-40 bg-slate-100 overflow-hidden">
                      <img src={gig.image_url} alt={gig.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    </div>
                  )}

                  {/* Proposal Sample Images */}
                  {gig.is_proposal && (gig.proposal_image1 || gig.proposal_image2) && (
                    <div className={`grid gap-0.5 ${gig.proposal_image1 && gig.proposal_image2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                      {gig.proposal_image1 && <div className="h-28 bg-slate-100 overflow-hidden"><img src={gig.proposal_image1} alt="Sample 1" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" /></div>}
                      {gig.proposal_image2 && <div className="h-28 bg-slate-100 overflow-hidden"><img src={gig.proposal_image2} alt="Sample 2" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" /></div>}
                    </div>
                  )}

                  <div className="p-5 flex flex-col flex-1">
                    {/* Title + Badges */}
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-lg font-black text-[var(--text-primary)] leading-tight pr-4 flex-1">{gig.title}</h3>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        {gig.is_proposal && <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider rounded-lg bg-indigo-100 text-indigo-600">Proposal</span>}
                        <span className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-lg ${gig.status === 'OPEN' ? 'bg-emerald-100 text-emerald-600' : gig.status === 'IN_PROGRESS' ? 'bg-[rgba(0,242,254,0.1)] text-[var(--accent-cyan)]' : 'bg-slate-100 text-[var(--text-secondary)]'}`}>
                          {gig.status.replace('_', ' ')}
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-[var(--text-secondary)] mb-4 flex-1 leading-relaxed">{gig.description}</p>

                    {/* Client & Budget */}
                    <div className="flex items-center justify-between border-t border-[var(--border-dim)] pt-4 mt-auto">
                      <button onClick={() => setProfileModal({ ...gig.clientProfile, wallet: gig.client_wallet })} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                        <img src={gig.clientProfile?.avatar} alt="" className="w-8 h-8 rounded-full border border-[var(--border-dim)] bg-slate-50" />
                        <div className="text-left">
                          <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">Client</p>
                          <p className="text-xs font-black text-[var(--text-primary)]">{gig.clientProfile?.name}</p>
                        </div>
                      </button>
                      <div className="text-right">
                        <p className="text-[10px] font-bold text-[var(--text-secondary)] uppercase">Budget</p>
                        <p className="text-base font-black text-emerald-600">${gig.budget} <span className="text-[10px] text-emerald-600/70">USDC</span></p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="mt-4 pt-4 border-t border-[var(--border-dim)] space-y-2">
                      {gig.status === 'OPEN' && gig.client_wallet !== userAddress?.toLowerCase() && (
                        <button onClick={() => handleApply(gig.id)} className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black transition-all">Accept Gig</button>
                      )}
                      {gig.status === 'IN_PROGRESS' && gig.client_wallet === userAddress?.toLowerCase() && (
                        <div className="space-y-2">
                          <div className="flex items-center gap-2 bg-[rgba(0,242,254,0.05)] p-2.5 rounded-xl border border-[var(--border-dim)]">
                            <img src={gig.freelancerProfile?.avatar} alt="" className="w-6 h-6 rounded-full bg-[var(--bg-card)]" />
                            <p className="text-[10px] font-bold text-blue-800">Freelancer: <span className="font-black">{gig.freelancerProfile?.name}</span> is working.</p>
                          </div>
                          <button onClick={() => setPayConfirmGig(gig)} className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 shadow-sm shadow-emerald-500/20">
                            <Send size={14} /> Pay & Complete
                          </button>
                        </div>
                      )}
                      {gig.status === 'IN_PROGRESS' && gig.freelancer_wallet === userAddress?.toLowerCase() && (
                        <div className="flex items-center justify-center gap-2 py-2.5 bg-[rgba(0,242,254,0.05)] text-[var(--accent-cyan)] rounded-xl border border-[var(--border-dim)] text-xs font-black"><Clock size={14} /> You are working on this</div>
                      )}
                      {gig.status === 'COMPLETED' && (
                        <div className="flex items-center justify-center gap-2 py-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100 text-xs font-black"><CheckCircle2 size={14} /> Payment Completed</div>
                      )}

                      <div className="flex gap-2">
                        <button onClick={() => openChat(gig)} className="flex-1 py-2.5 bg-slate-50 hover:bg-slate-100 text-[var(--text-secondary)] rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 border border-[var(--border-dim)]">
                          <MessageCircle size={14} /> Open Chat
                        </button>
                        {/* Delete button — only for owner */}
                        {gig.client_wallet === userAddress?.toLowerCase() && gig.status === 'OPEN' && (
                          <button onClick={() => handleDeleteGig(gig)} disabled={deleteLoading === gig.id} className="py-2.5 px-3 bg-red-50 hover:bg-red-100 text-red-500 rounded-xl text-xs font-black transition-all flex items-center justify-center border border-red-100 disabled:opacity-50">
                            {deleteLoading === gig.id ? <Loader2 className="animate-spin size-4" /> : <Trash2 size={14} />}
                          </button>
                        )}
                      </div>
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
