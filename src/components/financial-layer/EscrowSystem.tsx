'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Plus, CheckCircle, Clock, Send, Coins, Users, AlertCircle, FileText, ChevronRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Milestone {
  id: string;
  title: string;
  amount: number;
  status: 'Locked' | 'Under Review' | 'Released';
}

interface EscrowAgreement {
  id: string;
  title: string;
  client: string;
  freelancer: string;
  asset: 'USDC' | 'EURC';
  milestones: Milestone[];
  created_at: string;
}

export default function EscrowSystem() {
  const { isConnected, address: userAddress } = useAccount();

  // Escrow List States
  const [agreements, setAgreements] = useState<EscrowAgreement[]>([]);
  const [activeTab, setActiveTab] = useState<'client' | 'freelancer' | 'create'>('client');
  const [selectedAgreement, setSelectedAgreement] = useState<EscrowAgreement | null>(null);

  // Create Form States
  const [formTitle, setFormTitle] = useState('');
  const [formRole, setFormRole] = useState<'client' | 'freelancer'>('client');
  const [otherParty, setOtherParty] = useState('');
  const [formAsset, setFormAsset] = useState<'USDC' | 'EURC'>('USDC');
  
  // Milestones in Form
  const [milestones, setMilestones] = useState<Omit<Milestone, 'id' | 'status'>[]>([
    { title: 'Milestone 1: Design & Architecture', amount: 100 }
  ]);

  // Load agreements
  const loadAgreements = () => {
    if (!userAddress) return;
    const local = localStorage.getItem(`arclauncher_escrows_${userAddress.toLowerCase()}`);
    if (local) {
      setAgreements(JSON.parse(local));
    } else {
      // Mock defaults for a rich demonstration out of the box
      const mockAgreements: EscrowAgreement[] = [
        {
          id: 'esc-mock-1',
          title: 'ARC GLOBAL Landing Page Redesign',
          client: userAddress.toLowerCase(),
          freelancer: '0x218b09a7d9ff6d69082ac605bb27029bc321b5c3',
          asset: 'USDC',
          created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          milestones: [
            { id: 'm1', title: 'UX Wireframes & Color Palette', amount: 150, status: 'Released' },
            { id: 'm2', title: 'High-Fidelity Component Prototypes', amount: 200, status: 'Under Review' },
            { id: 'm3', title: 'Production Tailwind Integration', amount: 250, status: 'Locked' }
          ]
        }
      ];
      localStorage.setItem(`arclauncher_escrows_${userAddress.toLowerCase()}`, JSON.stringify(mockAgreements));
      setAgreements(mockAgreements);
    }
  };

  useEffect(() => {
    if (isConnected && userAddress) {
      loadAgreements();
    }
  }, [isConnected, userAddress]);

  const handleAddFormMilestone = () => {
    setMilestones([...milestones, { title: `Milestone ${milestones.length + 1}: Details`, amount: 100 }]);
  };

  const handleRemoveFormMilestone = (idx: number) => {
    if (milestones.length === 1) return;
    setMilestones(milestones.filter((_, i) => i !== idx));
  };

  const handleUpdateFormMilestone = (idx: number, field: 'title' | 'amount', val: any) => {
    setMilestones(milestones.map((m, i) => i === idx ? { ...m, [field]: val } : m));
  };

  const handleCreateAgreement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !userAddress) {
      alert('Please connect your wallet first.');
      return;
    }

    if (!formTitle.trim() || !otherParty.trim()) {
      alert('Fill in all details.');
      return;
    }

    const totalCost = milestones.reduce((sum, m) => sum + Number(m.amount), 0);

    // If client, check and deduct balance for funding the entire escrow!
    if (formRole === 'client') {
      const balanceKey = formAsset === 'USDC' 
        ? `sim_usdc_${userAddress.toLowerCase()}` 
        : `sim_eurc_${userAddress.toLowerCase()}`;
      const balanceVal = localStorage.getItem(balanceKey);
      const activeBalance = balanceVal ? Number(balanceVal) : (formAsset === 'USDC' ? 1000.00 : 500.00);

      if (totalCost > activeBalance) {
        alert(`Insufficient ${formAsset} balance to fund this escrow system. Need ${totalCost} ${formAsset}, active balance: ${activeBalance} ${formAsset}.`);
        return;
      }

      // Deduct balance
      localStorage.setItem(balanceKey, (activeBalance - totalCost).toFixed(2));
      // Dispatch storage event to alert other components
      window.dispatchEvent(new Event('storage'));
    }

    const newEscrow: EscrowAgreement = {
      id: 'esc-' + Math.random().toString(36).substring(2, 11),
      title: formTitle,
      client: formRole === 'client' ? userAddress.toLowerCase() : otherParty.toLowerCase(),
      freelancer: formRole === 'freelancer' ? userAddress.toLowerCase() : otherParty.toLowerCase(),
      asset: formAsset,
      created_at: new Date().toISOString(),
      milestones: milestones.map((m, idx) => ({
        id: `mil-${idx}-${Math.random().toString(36).substring(2, 6)}`,
        title: m.title,
        amount: Number(m.amount),
        status: 'Locked' // Staged under client escrow security lock
      }))
    };

    const updated = [newEscrow, ...agreements];
    setAgreements(updated);
    localStorage.setItem(`arclauncher_escrows_${userAddress.toLowerCase()}`, JSON.stringify(updated));

    // Propagate escrow records back to other party if mock address matches user
    localStorage.setItem(`arclauncher_escrows_${otherParty.toLowerCase()}`, JSON.stringify([
      newEscrow,
      ...(JSON.parse(localStorage.getItem(`arclauncher_escrows_${otherParty.toLowerCase()}`) || '[]'))
    ]));

    // Reset Form
    setFormTitle('');
    setOtherParty('');
    setMilestones([{ title: 'Milestone 1: Design & Architecture', amount: 100 }]);
    setActiveTab(formRole);
    setSelectedAgreement(newEscrow);
    alert(`Escrow agreement created successfully! Total amount of ${totalCost} ${formAsset} is secured.`);
  };

  const handleMilestoneAction = (agreementId: string, milestoneId: string, action: 'submit' | 'release') => {
    if (!userAddress) return;

    const agreement = agreements.find(a => a.id === agreementId);
    if (!agreement) return;

    const updatedAgreements = agreements.map(a => {
      if (a.id === agreementId) {
        const updatedMilestones = a.milestones.map(m => {
          if (m.id === milestoneId) {
            if (action === 'submit' && m.status === 'Locked') {
              return { ...m, status: 'Under Review' as const };
            }
            if (action === 'release' && m.status === 'Under Review') {
              // 1. Release simulated funds directly to freelancer's balance card!
              const balanceKey = a.asset === 'USDC' 
                ? `sim_usdc_${a.freelancer.toLowerCase()}` 
                : `sim_eurc_${a.freelancer.toLowerCase()}`;
              const balanceVal = localStorage.getItem(balanceKey);
              const currentBal = balanceVal ? Number(balanceVal) : (a.asset === 'USDC' ? 1000.00 : 500.00);
              localStorage.setItem(balanceKey, (currentBal + m.amount).toFixed(2));
              window.dispatchEvent(new Event('storage'));

              // 2. Award reward points +1 per 10 USDC volume transacted to both parties!
              const pointsEarned = m.amount / 10;
              [a.client, a.freelancer].forEach(async (wallet) => {
                try {
                  const { data } = await supabase
                    .from('user_stats')
                    .select('*')
                    .eq('wallet', wallet.toLowerCase());
                  if (data && data.length > 0) {
                    await supabase
                      .from('user_stats')
                      .update({
                        total_volume: Number(data[0].total_volume || 0) + m.amount,
                        points: Number(data[0].points || 0) + pointsEarned
                      })
                      .eq('wallet', wallet.toLowerCase());
                  } else {
                    await supabase
                      .from('user_stats')
                      .insert({
                        wallet: wallet.toLowerCase(),
                        total_volume: m.amount,
                        points: pointsEarned
                      });
                  }
                } catch (e) {
                  console.error('Error allocating milestone points:', e);
                }
              });

              return { ...m, status: 'Released' as const };
            }
          }
          return m;
        });
        return { ...a, milestones: updatedMilestones };
      }
      return a;
    });

    setAgreements(updatedAgreements);
    localStorage.setItem(`arclauncher_escrows_${userAddress.toLowerCase()}`, JSON.stringify(updatedAgreements));

    // Sync other party
    const targetParty = userAddress.toLowerCase() === agreement.client ? agreement.freelancer : agreement.client;
    localStorage.setItem(`arclauncher_escrows_${targetParty.toLowerCase()}`, JSON.stringify(updatedAgreements));

    const updatedSelect = updatedAgreements.find(a => a.id === agreementId);
    if (updatedSelect) setSelectedAgreement(updatedSelect);

    if (action === 'release') {
      alert(`Milestone successfully approved and released! ${agreement.asset} ${agreement.milestones.find(m => m.id === milestoneId)?.amount} paid directly to the freelancer's wallet.`);
    }
  };

  const clientAgreements = agreements.filter(a => a.client === userAddress?.toLowerCase());
  const freelancerAgreements = agreements.filter(a => a.freelancer === userAddress?.toLowerCase());
  const displayAgreements = activeTab === 'client' ? clientAgreements : freelancerAgreements;

  return (
    <div className="space-y-6">
      
      {/* Tab Switcher */}
      <div className="flex gap-2 p-1.5 bg-slate-100 border border-slate-200/50 rounded-2xl">
        <button
          onClick={() => {
            setActiveTab('client');
            setSelectedAgreement(null);
          }}
          className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer ${
            activeTab === 'client' ? 'bg-white text-blue-600 shadow-sm border border-slate-200/40' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          💼 Client Escrows
        </button>
        <button
          onClick={() => {
            setActiveTab('freelancer');
            setSelectedAgreement(null);
          }}
          className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer ${
            activeTab === 'freelancer' ? 'bg-white text-blue-600 shadow-sm border border-slate-200/40' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          🛠️ Freelancer Agreements
        </button>
        <button
          onClick={() => {
            setActiveTab('create');
            setSelectedAgreement(null);
          }}
          className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer ${
            activeTab === 'create' ? 'bg-white text-blue-600 shadow-sm border border-slate-200/40' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          ➕ Secure Escrow Setup
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* CREATE ESCROW FORM TAB */}
        {activeTab === 'create' && (
          <div className="lg:col-span-12 bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="border-b border-slate-100 pb-5">
              <h3 className="font-extrabold text-slate-800 text-sm flex items-center gap-2"><ShieldCheck className="text-blue-600" size={18} /> Setup Secured Multi-Milestone Escrow Contract</h3>
              <p className="text-[10px] text-slate-500 font-semibold">Funds are locked securely in an incremental milestone release protocol using USDC or EURC.</p>
            </div>

            <form onSubmit={handleCreateAgreement} className="space-y-6">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Project Agreement Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Design & Build ARC Dashboard"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:border-blue-500"
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Stablecoin Asset</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormAsset('USDC')}
                      className={`py-3 rounded-xl border text-xs font-bold transition-all ${
                        formAsset === 'USDC' ? 'border-blue-500 bg-blue-50/50 text-blue-600' : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      USDC (6 Decimals)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormAsset('EURC')}
                      className={`py-3 rounded-xl border text-xs font-bold transition-all ${
                        formAsset === 'EURC' ? 'border-blue-500 bg-blue-50/50 text-blue-600' : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      EURC (18 Decimals)
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">My Role in Project</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormRole('client')}
                      className={`py-3 rounded-xl border text-xs font-bold transition-all ${
                        formRole === 'client' ? 'border-blue-500 bg-blue-50/50 text-blue-600' : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      Client (Funder)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormRole('freelancer')}
                      className={`py-3 rounded-xl border text-xs font-bold transition-all ${
                        formRole === 'freelancer' ? 'border-blue-500 bg-blue-50/50 text-blue-600' : 'border-slate-200 bg-slate-50'
                      }`}
                    >
                      Freelancer (Receiver)
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">
                    {formRole === 'client' ? 'Freelancer Address' : 'Client Address'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="0x..."
                    value={otherParty}
                    onChange={(e) => setOtherParty(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Milestones dynamic list builder */}
              <div className="space-y-3">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block flex items-center gap-1"><FileText size={14} className="text-blue-500" /> Incremental Milestones Definition</label>
                  <button
                    type="button"
                    onClick={handleAddFormMilestone}
                    className="text-[10px] font-black text-blue-600 bg-blue-50 border border-blue-100 hover:bg-blue-100 px-3 py-1.5 rounded-xl transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Plus size={12} /> Add Milestone
                  </button>
                </div>

                <div className="space-y-3.5 max-h-[220px] overflow-y-auto pr-1">
                  {milestones.map((m, idx) => (
                    <div key={idx} className="flex gap-4 items-center bg-slate-50 border border-slate-200/50 rounded-2xl p-4.5">
                      <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 font-extrabold text-[10px] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        placeholder="Milestone title..."
                        value={m.title}
                        required
                        onChange={(e) => handleUpdateFormMilestone(idx, 'title', e.target.value)}
                        className="flex-1 bg-transparent border-b border-slate-200 focus:border-blue-500 focus:outline-none text-xs font-semibold py-1"
                      />
                      <div className="relative w-32 shrink-0">
                        <input
                          type="number"
                          placeholder="Amount"
                          value={m.amount}
                          required
                          onChange={(e) => handleUpdateFormMilestone(idx, 'amount', e.target.value)}
                          className="w-full bg-transparent border-b border-slate-200 focus:border-blue-500 focus:outline-none text-xs font-mono font-bold py-1 pr-8 text-right"
                        />
                        <span className="absolute right-1 top-1 text-[9px] font-bold text-slate-400">{formAsset}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFormMilestone(idx)}
                        disabled={milestones.length === 1}
                        className="text-xs text-rose-500 hover:bg-rose-50 p-2 rounded-lg disabled:opacity-30 cursor-pointer"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-[10.5px] font-bold text-slate-500 leading-normal flex items-start gap-3">
                <AlertCircle className="text-blue-500 shrink-0 mt-0.5" size={16} />
                <span>
                  {formRole === 'client' 
                    ? `Creating this agreement as a CLIENT will fund the entire contract of ${milestones.reduce((s, m) => s + Number(m.amount || 0), 0)} ${formAsset} immediately from your active wallet balance. Funds will remain locked until milestones are approved.`
                    : `Creating this agreement as a FREELANCER will propose the milestones protocol to the client. The client will need to review and fund the contract structure before it initiates.`}
                </span>
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm tracking-wide uppercase transition-all shadow-md shadow-blue-500/10 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ShieldCheck size={16} /> Secure Agreement & Fund Escrow Vault
              </button>

            </form>
          </div>
        )}

        {/* AGREEMENTS LIST VIEW */}
        {activeTab !== 'create' && (
          <>
            {/* Left list container */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm space-y-4 max-h-[500px] overflow-y-auto">
                <div className="border-b border-slate-100 pb-3">
                  <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Active Secure Escrows</h4>
                </div>

                {displayAgreements.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 space-y-2">
                    <ShieldCheck size={28} className="mx-auto text-slate-200" />
                    <p className="text-xs font-bold">No active agreements found.</p>
                    <p className="text-[10px]">Create an agreement above to secure your contract payrolls!</p>
                  </div>
                ) : (
                  displayAgreements.map(a => {
                    const totalCost = a.milestones.reduce((s, m) => s + m.amount, 0);
                    const releasedCount = a.milestones.filter(m => m.status === 'Released').length;
                    
                    return (
                      <button
                        key={a.id}
                        onClick={() => setSelectedAgreement(a)}
                        className={`w-full text-left p-4.5 rounded-2xl border transition-all cursor-pointer flex justify-between items-center gap-4 ${
                          selectedAgreement?.id === a.id 
                            ? 'border-blue-500 bg-blue-50/20 shadow-sm' 
                            : 'border-slate-100 bg-slate-50 hover:bg-slate-100/50'
                        }`}
                      >
                        <div className="space-y-1 min-w-0">
                          <span className="text-[9px] text-blue-600 font-extrabold uppercase tracking-wider block">ID: {a.id}</span>
                          <h4 className="text-xs font-black text-slate-850 truncate">{a.title}</h4>
                          <span className="text-[10px] text-slate-500 font-semibold block mt-1">
                            Budget: <strong className="text-slate-800 font-extrabold">{totalCost} {a.asset}</strong>
                          </span>
                          <span className="text-[9.5px] text-slate-400 font-bold block">
                            Milestones: {releasedCount} of {a.milestones.length} paid
                          </span>
                        </div>
                        <ChevronRight size={15} className="text-slate-400 shrink-0" />
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right progress dashboard detail panel */}
            <div className="lg:col-span-7">
              <AnimatePresence mode="wait">
                {selectedAgreement ? (
                  <motion.div
                    key={selectedAgreement.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-7 shadow-sm space-y-6"
                  >
                    {/* Header */}
                    <div className="flex justify-between items-start gap-4 border-b border-slate-100 pb-5">
                      <div>
                        <span className="text-[10px] text-blue-600 font-black uppercase tracking-widest block">Agreement secured 🔒</span>
                        <h3 className="font-black text-slate-900 text-base mt-1">{selectedAgreement.title}</h3>
                        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-2.5 text-[10px] text-slate-400 font-bold">
                          <span>Client: <strong className="text-slate-600 font-black font-mono">{selectedAgreement.client.slice(0, 8)}...{selectedAgreement.client.slice(-6)}</strong></span>
                          <span>Freelancer: <strong className="text-slate-600 font-black font-mono">{selectedAgreement.freelancer.slice(0, 8)}...{selectedAgreement.freelancer.slice(-6)}</strong></span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] text-slate-400 font-black uppercase tracking-wider block">Total Vault Value</span>
                        <span className="text-xl font-black text-slate-800 tracking-tight block mt-0.5">
                          {selectedAgreement.milestones.reduce((s, m) => s + m.amount, 0)} {selectedAgreement.asset}
                        </span>
                      </div>
                    </div>

                    {/* Milestones Progression Visual Timeline */}
                    <div className="space-y-5 relative">
                      {/* Central connecting guide line */}
                      <div className="absolute left-[20px] top-[15px] bottom-[15px] w-[2px] bg-slate-100 -z-10" />

                      {selectedAgreement.milestones.map((m, idx) => (
                        <div
                          key={m.id}
                          className={`flex items-start gap-4 p-4 rounded-2xl border transition-all ${
                            m.status === 'Released'
                              ? 'border-slate-100 bg-slate-50/50 opacity-75'
                              : m.status === 'Under Review'
                              ? 'border-amber-300 bg-amber-50/20'
                              : 'border-blue-200 bg-blue-50/10'
                          }`}
                        >
                          {/* Step number marker */}
                          <div className="shrink-0 flex items-center justify-center">
                            {m.status === 'Released' ? (
                              <div className="w-10 h-10 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center justify-center shadow-sm">
                                <CheckCircle size={18} />
                              </div>
                            ) : m.status === 'Under Review' ? (
                              <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-100 text-amber-600 flex items-center justify-center shadow-sm animate-pulse">
                                <Clock size={18} />
                              </div>
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs shadow-sm">
                                {idx + 1}
                              </div>
                            )}
                          </div>

                          {/* Milestone details and actions */}
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex justify-between items-start gap-4">
                              <div>
                                <h4 className={`text-xs font-black ${m.status === 'Released' ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                                  {m.title}
                                </h4>
                                <span className={`text-[8.5px] font-black uppercase tracking-wider inline-block mt-1 px-2 py-0.5 rounded-full ${
                                  m.status === 'Released' 
                                    ? 'bg-emerald-100 text-emerald-700' 
                                    : m.status === 'Under Review'
                                    ? 'bg-amber-100 text-amber-700'
                                    : 'bg-blue-100 text-blue-700'
                                }`}>
                                  {m.status === 'Released' ? 'Funds Released' : m.status === 'Under Review' ? 'Under Review' : 'Locked Staged'}
                                </span>
                              </div>
                              <span className="text-xs font-black font-mono text-slate-850 shrink-0">
                                {m.amount} {selectedAgreement.asset}
                              </span>
                            </div>

                            {/* Milestone Actions Panel */}
                            {m.status !== 'Released' && (
                              <div className="flex justify-end pt-1">
                                {activeTab === 'freelancer' && m.status === 'Locked' && (
                                  <button
                                    onClick={() => handleMilestoneAction(selectedAgreement.id, m.id, 'submit')}
                                    className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 shadow-sm cursor-pointer"
                                  >
                                    <Send size={11} /> Submit for Review
                                  </button>
                                )}
                                {activeTab === 'client' && m.status === 'Under Review' && (
                                  <button
                                    onClick={() => handleMilestoneAction(selectedAgreement.id, m.id, 'release')}
                                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 shadow-sm cursor-pointer"
                                  >
                                    <CheckCircle size={11} /> Release Milestones Payment
                                  </button>
                                )}
                                {activeTab === 'client' && m.status === 'Locked' && (
                                  <span className="text-[10px] text-slate-400 font-semibold block">Waiting for freelancer to submit deliverables.</span>
                                )}
                                {activeTab === 'freelancer' && m.status === 'Under Review' && (
                                  <span className="text-[10px] text-amber-600 font-semibold block flex items-center gap-1 animate-pulse"><Clock size={12} /> Milestone submitted. Client review pending.</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                  </motion.div>
                ) : (
                  <div className="bg-slate-50 border border-dashed border-slate-200 rounded-3xl p-12 text-center text-slate-400 space-y-3">
                    <ShieldCheck size={36} className="mx-auto text-slate-200" />
                    <div>
                      <h4 className="font-extrabold text-xs text-slate-500 uppercase tracking-wide">Agreement Details Panel</h4>
                      <p className="text-[10px] max-w-xs mx-auto leading-relaxed mt-1">Select an active agreement on the left index list to monitor milestones progression, submit work, or release locked funds.</p>
                    </div>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </>
        )}

      </div>

    </div>
  );
}
