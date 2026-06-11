'use client';

import { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Plus, Clock, Search, Send, Play, Pause, Trash2, Calendar, Users, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface ProfileData {
  wallet: string;
  name: string;
  avatar: string;
}

interface AutoPayJob {
  id: string;
  recipientWallet: string;
  recipientName: string;
  recipientAvatar: string;
  amount: number;
  asset: 'USDC' | 'EURC';
  frequency: 'monthly' | 'onetime';
  executeAt: string; // ISO string
  status: 'Active' | 'Paused' | 'Executed' | 'Failed';
  lastExecutedAt?: string;
}

export default function AutoPay() {
  const { isConnected, address: userAddress } = useAccount();

  // Active schedules and UI views
  const [jobs, setJobs] = useState<AutoPayJob[]>([]);
  const [activeTab, setActiveTab] = useState<'schedules' | 'create'>('schedules');

  // Search states
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ProfileData[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedRecipient, setSelectedRecipient] = useState<ProfileData | null>(null);
  const [customWallet, setCustomWallet] = useState('');

  // Form states
  const [formAsset, setFormAsset] = useState<'USDC' | 'EURC'>('USDC');
  const [formAmount, setFormAmount] = useState('');
  const [formFrequency, setFormFrequency] = useState<'monthly' | 'onetime'>('monthly');
  const [formDate, setFormDate] = useState('');

  // Load AutoPay schedule jobs
  const loadJobs = () => {
    if (!userAddress) return;
    const wallet = userAddress.toLowerCase();
    const local = localStorage.getItem(`arcomni_autopay_${wallet}`);
    if (local) {
      setJobs(JSON.parse(local));
    } else {
      // Initialize with mock payroll out of the box for gorgeous presentation
      const mockJobs: AutoPayJob[] = [
        {
          id: 'pay-mock-1',
          recipientWallet: '0x218b09a7d9ff6d69082ac605bb27029bc321b5c3',
          recipientName: 'Lead Designer',
          recipientAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=LeadDesigner',
          amount: 250,
          asset: 'USDC',
          frequency: 'monthly',
          executeAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
          status: 'Active'
        },
        {
          id: 'pay-mock-2',
          recipientWallet: '0xe88a1b020d29db8cfccfbba17c5bba62efbc40c1',
          recipientName: 'Smart Contract Auditor',
          recipientAvatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=Auditor',
          amount: 150,
          asset: 'EURC',
          frequency: 'onetime',
          executeAt: new Date(Date.now() - 1000).toISOString(), // Past-due for execution test!
          status: 'Active'
        }
      ];
      localStorage.setItem(`arcomni_autopay_${wallet}`, JSON.stringify(mockJobs));
      setJobs(mockJobs);
    }
  };

  useEffect(() => {
    if (isConnected && userAddress) {
      loadJobs();
    }
  }, [isConnected, userAddress]);

  // Recipient search effect
  useEffect(() => {
    const handleSearch = async () => {
      const q = searchQuery.trim();
      if (q.length >= 2) {
        setSearchLoading(true);
        try {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .ilike('name', `%${q}%`)
            .limit(5);

          if (data) {
            setSearchResults(data.map(p => ({
              wallet: p.wallet,
              name: p.name || 'Anonymous',
              avatar: p.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${p.wallet}`
            })));
          }
        } catch (e) {
          console.error(e);
        } finally {
          setSearchLoading(false);
        }
      } else {
        setSearchResults([]);
      }
    };

    const delay = setTimeout(handleSearch, 300);
    return () => clearTimeout(delay);
  }, [searchQuery]);

  // Client-Side Automation Engine loop
  useEffect(() => {
    if (!isConnected || !userAddress) return;
    const wallet = userAddress.toLowerCase();

    const checkAndExecuteJobs = async () => {
      const currentJobs = JSON.parse(localStorage.getItem(`arcomni_autopay_${wallet}`) || '[]');
      if (currentJobs.length === 0) return;

      let balanceUpdated = false;
      const updatedJobs = await Promise.all(currentJobs.map(async (job: AutoPayJob) => {
        if (job.status === 'Active' && new Date(job.executeAt).getTime() <= Date.now()) {
          // Time to execute!
          const balanceKey = job.asset === 'USDC' ? `sim_usdc_${wallet}` : `sim_eurc_${wallet}`;
          const balanceVal = localStorage.getItem(balanceKey);
          const currentBal = balanceVal ? Number(balanceVal) : (job.asset === 'USDC' ? 1000.00 : 500.00);

          if (currentBal >= job.amount) {
            // 1. Deduct balance from sender
            localStorage.setItem(balanceKey, (currentBal - job.amount).toFixed(2));

            // 2. Credit balance to recipient
            const recBalanceKey = job.asset === 'USDC' ? `sim_usdc_${job.recipientWallet.toLowerCase()}` : `sim_eurc_${job.recipientWallet.toLowerCase()}`;
            const recBalanceVal = localStorage.getItem(recBalanceKey);
            const recCurrentBal = recBalanceVal ? Number(recBalanceVal) : (job.asset === 'USDC' ? 1000.00 : 500.00);
            localStorage.setItem(recBalanceKey, (recCurrentBal + job.amount).toFixed(2));

            balanceUpdated = true;

            // 3. Award points in Supabase
            const pointsEarned = job.amount / 10;
            try {
              const { data } = await supabase
                .from('user_stats')
                .select('*')
                .eq('wallet', wallet);

              if (data && data.length > 0) {
                await supabase
                  .from('user_stats')
                  .update({
                    total_volume: Number(data[0].total_volume || 0) + job.amount,
                    points: Number(data[0].points || 0) + pointsEarned
                  })
                  .eq('wallet', wallet);
              } else {
                await supabase
                  .from('user_stats')
                  .insert({
                    wallet: wallet,
                    total_volume: job.amount,
                    points: pointsEarned
                  });
              }
            } catch (err) {
              console.error('AutoPay Supabase points sync error:', err);
            }

            // 4. Update job metadata
            const nextDate = job.frequency === 'monthly'
              ? new Date(new Date(job.executeAt).setMonth(new Date(job.executeAt).getMonth() + 1)).toISOString()
              : job.executeAt;

            alert(`🎉 AutoPay triggered! Successfully sent automated transfer of ${job.amount} ${job.asset} to @${job.recipientName}.`);

            return {
              ...job,
              status: job.frequency === 'monthly' ? 'Active' as const : 'Executed' as const,
              executeAt: nextDate,
              lastExecutedAt: new Date().toISOString()
            };
          } else {
            // Insufficient Balance
            alert(`⚠️ AutoPay failed! Insufficient ${job.asset} balance to execute automated payment of ${job.amount} to @${job.recipientName}.`);
            return {
              ...job,
              status: 'Failed' as const
            };
          }
        }
        return job;
      }));

      if (balanceUpdated) {
        setJobs(updatedJobs);
        localStorage.setItem(`arcomni_autopay_${wallet}`, JSON.stringify(updatedJobs));
        window.dispatchEvent(new Event('storage'));
      }
    };

    // Run on startup and every 10 seconds
    const interval = setInterval(checkAndExecuteJobs, 10000);
    checkAndExecuteJobs();

    return () => clearInterval(interval);
  }, [isConnected, userAddress]);

  const handleCreateSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !userAddress) {
      alert('Please connect your wallet first.');
      return;
    }

    if (!selectedRecipient && !customWallet) {
      alert('Specify a recipient username or custom wallet.');
      return;
    }

    if (!formAmount || Number(formAmount) <= 0) {
      alert('Enter a valid payment amount.');
      return;
    }

    if (!formDate) {
      alert('Select a future schedule execution date.');
      return;
    }

    const wallet = userAddress.toLowerCase();
    const finalWallet = selectedRecipient ? selectedRecipient.wallet : customWallet.toLowerCase();
    const finalName = selectedRecipient ? selectedRecipient.name : `Wallet (${finalWallet.slice(0, 6)}...)`;
    const finalAvatar = selectedRecipient ? selectedRecipient.avatar : `https://api.dicebear.com/7.x/bottts/svg?seed=${finalWallet}`;

    const newJob: AutoPayJob = {
      id: 'pay-' + Math.random().toString(36).substring(2, 11),
      recipientWallet: finalWallet,
      recipientName: finalName,
      recipientAvatar: finalAvatar,
      amount: Number(formAmount),
      asset: formAsset,
      frequency: formFrequency,
      executeAt: new Date(formDate).toISOString(),
      status: 'Active'
    };

    const updated = [newJob, ...jobs];
    setJobs(updated);
    localStorage.setItem(`arcomni_autopay_${wallet}`, JSON.stringify(updated));

    // Reset Form
    setSelectedRecipient(null);
    setCustomWallet('');
    setFormAmount('');
    setFormDate('');
    setActiveTab('schedules');
    alert(`Automation schedule created! Next execution set for ${new Date(newJob.executeAt).toLocaleString()}`);
  };

  const handleToggleJob = (jobId: string) => {
    if (!userAddress) return;
    const wallet = userAddress.toLowerCase();
    const updated = jobs.map(j => {
      if (j.id === jobId) {
        const nextStatus = j.status === 'Paused' ? 'Active' as const : 'Paused' as const;
        return { ...j, status: nextStatus };
      }
      return j;
    });
    setJobs(updated);
    localStorage.setItem(`arcomni_autopay_${wallet}`, JSON.stringify(updated));
  };

  const handleDeleteJob = (jobId: string) => {
    if (!userAddress) return;
    const wallet = userAddress.toLowerCase();
    const updated = jobs.filter(j => j.id !== jobId);
    setJobs(updated);
    localStorage.setItem(`arcomni_autopay_${wallet}`, JSON.stringify(updated));
  };

  const handleForceTrigger = async (jobId: string) => {
    if (!userAddress) return;
    const wallet = userAddress.toLowerCase();
    
    // Find job
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;

    const balanceKey = job.asset === 'USDC' ? `sim_usdc_${wallet}` : `sim_eurc_${wallet}`;
    const balanceVal = localStorage.getItem(balanceKey);
    const currentBal = balanceVal ? Number(balanceVal) : (job.asset === 'USDC' ? 1000.00 : 500.00);

    if (currentBal < job.amount) {
      alert(`Insufficient ${job.asset} balance to force trigger this payment. Need ${job.amount}, active: ${currentBal}`);
      return;
    }

    // Deduct balance
    localStorage.setItem(balanceKey, (currentBal - job.amount).toFixed(2));

    // Credit balance
    const recBalanceKey = job.asset === 'USDC' ? `sim_usdc_${job.recipientWallet.toLowerCase()}` : `sim_eurc_${job.recipientWallet.toLowerCase()}`;
    const recBalanceVal = localStorage.getItem(recBalanceKey);
    const recCurrentBal = recBalanceVal ? Number(recBalanceVal) : (job.asset === 'USDC' ? 1000.00 : 500.00);
    localStorage.setItem(recBalanceKey, (recCurrentBal + job.amount).toFixed(2));

    // Points sync on Supabase
    const pointsEarned = job.amount / 10;
    try {
      const { data } = await supabase
        .from('user_stats')
        .select('*')
        .eq('wallet', wallet);

      if (data && data.length > 0) {
        await supabase
          .from('user_stats')
          .update({
            total_volume: Number(data[0].total_volume || 0) + job.amount,
            points: Number(data[0].points || 0) + pointsEarned
          })
          .eq('wallet', wallet);
      } else {
        await supabase
          .from('user_stats')
          .insert({
            wallet: wallet,
            total_volume: job.amount,
            points: pointsEarned
          });
      }
    } catch (err) {
      console.error(err);
    }

    const nextDate = job.frequency === 'monthly'
      ? new Date(new Date(job.executeAt).setMonth(new Date(job.executeAt).getMonth() + 1)).toISOString()
      : job.executeAt;

    const updated = jobs.map(j => {
      if (j.id === jobId) {
        return {
          ...j,
          status: j.frequency === 'monthly' ? 'Active' as const : 'Executed' as const,
          executeAt: nextDate,
          lastExecutedAt: new Date().toISOString()
        };
      }
      return j;
    });

    setJobs(updated);
    localStorage.setItem(`arcomni_autopay_${wallet}`, JSON.stringify(updated));
    window.dispatchEvent(new Event('storage'));

    alert(`Successfully processed instant force payment execution! Sent ${job.amount} ${job.asset} to @${job.recipientName}.`);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Controller Tabs */}
      <div className="flex gap-2 p-1.5 bg-slate-100 border border-[var(--border-dim)] rounded-2xl">
        <button
          type="button"
          onClick={() => setActiveTab('schedules')}
          className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer ${
            activeTab === 'schedules' ? 'bg-[var(--bg-card)] text-[var(--accent-cyan)] shadow-sm border border-[var(--border-dim)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          📅 Active Automations Registry
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('create')}
          className={`flex-1 py-3 rounded-xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer ${
            activeTab === 'create' ? 'bg-[var(--bg-card)] text-[var(--accent-cyan)] shadow-sm border border-[var(--border-dim)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          ➕ Configure AutoPay Schedule
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6">
        
        {/* CREATE AUTO-PAY SCHEDULE TAB */}
        {activeTab === 'create' && (
          <div className="card rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="border-b border-[var(--border-dim)] pb-5">
              <h3 className="font-extrabold text-[var(--text-primary)] text-sm flex items-center gap-2"><Clock className="text-[var(--accent-cyan)]" size={18} /> Schedule Stablecoin Payroll transfer</h3>
              <p className="text-[10px] text-[var(--text-secondary)] font-semibold">Setup monthly payroll triggers or post-dated one-time stablecoin allocations targeting custom usernames.</p>
            </div>

            <form onSubmit={handleCreateSchedule} className="space-y-6">
              
              {/* Recipient Selection */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest">Recipient Username / Wallet</label>
                {selectedRecipient ? (
                  <div className="flex items-center justify-between p-4 bg-[rgba(0,242,254,0.05)] border border-[var(--border-dim)] rounded-2xl">
                    <div className="flex items-center gap-3">
                      <img src={selectedRecipient.avatar} className="w-10 h-10 rounded-xl overflow-hidden border border-[var(--border-dim)]" alt="" />
                      <div>
                        <h4 className="font-black text-[var(--text-primary)] text-xs">@{selectedRecipient.name}</h4>
                        <p className="text-[9px] text-[var(--text-secondary)] font-mono mt-0.5">{selectedRecipient.wallet.slice(0, 10)}...{selectedRecipient.wallet.slice(-8)}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedRecipient(null)}
                      className="text-[10px] font-extrabold text-[var(--accent-cyan)] card px-3 py-1.5 rounded-xl hover:bg-slate-50 transition-all"
                    >
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={15} />
                      <input
                        type="text"
                        placeholder="Search recipient username (e.g. Frianowzki)..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-11 pr-4 py-3.5 bg-[var(--bg-card)] border border-[var(--border-dim)] rounded-2xl text-xs font-semibold outline-none focus:border-blue-500 focus:bg-[var(--bg-card)] transition-all"
                      />
                      {searchLoading && <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 animate-spin text-[var(--accent-cyan)] size-4" />}
                    </div>

                    {searchResults.length > 0 && (
                      <div className="border border-[var(--border-dim)] rounded-2xl overflow-hidden card shadow-xl max-h-[180px] overflow-y-auto">
                        {searchResults.map((p) => (
                          <button
                            key={p.wallet}
                            type="button"
                            onClick={() => {
                              setSelectedRecipient(p);
                              setSearchQuery('');
                              setSearchResults([]);
                            }}
                            className="w-full flex items-center justify-between p-3 hover:bg-slate-50 border-b border-[var(--border-dim)] last:border-0 text-left cursor-pointer"
                          >
                            <div className="flex items-center gap-3">
                              <img src={p.avatar} className="w-8 h-8 rounded-lg border border-[var(--border-dim)]" alt="" />
                              <div>
                                <span className="text-xs font-black text-[var(--text-primary)] block">@{p.name}</span>
                                <span className="text-[8px] text-[var(--text-secondary)] font-mono block mt-0.5">{p.wallet}</span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-3">
                      <span className="text-[9px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">Or Input Custom Destination Wallet</span>
                      <hr className="flex-1 border-[var(--border-dim)]" />
                    </div>

                    <input
                      type="text"
                      placeholder="Enter custom wallet address (0x...)"
                      value={customWallet}
                      onChange={(e) => setCustomWallet(e.target.value)}
                      className="w-full px-4 py-3.5 bg-[var(--bg-card)] border border-[var(--border-dim)] rounded-2xl text-xs font-mono outline-none focus:border-blue-500 focus:bg-[var(--bg-card)] transition-all"
                    />
                  </div>
                )}
              </div>

              {/* Asset Select */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest">Select Stablecoin</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormAsset('USDC')}
                      className={`py-3 rounded-xl border text-xs font-bold transition-all ${
                        formAsset === 'USDC' ? 'border-blue-500 bg-[rgba(0,242,254,0.05)] text-[var(--accent-cyan)]' : 'border-[var(--border-dim)] bg-slate-50'
                      }`}
                    >
                      USDC Stablecoin
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormAsset('EURC')}
                      className={`py-3 rounded-xl border text-xs font-bold transition-all ${
                        formAsset === 'EURC' ? 'border-blue-500 bg-[rgba(0,242,254,0.05)] text-[var(--accent-cyan)]' : 'border-[var(--border-dim)] bg-slate-50'
                      }`}
                    >
                      EURC Stablecoin
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest">Payment Amount</label>
                  <input
                    type="number"
                    required
                    placeholder="0.00"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    className="w-full px-4 py-3.5 bg-[var(--bg-card)] border border-[var(--border-dim)] rounded-xl text-xs font-mono font-bold outline-none focus:border-blue-500 focus:bg-[var(--bg-card)] transition-all"
                  />
                </div>
              </div>

              {/* Schedule Select */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest">Frequency Configuration</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setFormFrequency('monthly')}
                      className={`py-3 rounded-xl border text-xs font-bold transition-all ${
                        formFrequency === 'monthly' ? 'border-blue-500 bg-[rgba(0,242,254,0.05)] text-[var(--accent-cyan)]' : 'border-[var(--border-dim)] bg-slate-50'
                      }`}
                    >
                      Monthly Payroll
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormFrequency('onetime')}
                      className={`py-3 rounded-xl border text-xs font-bold transition-all ${
                        formFrequency === 'onetime' ? 'border-blue-500 bg-[rgba(0,242,254,0.05)] text-[var(--accent-cyan)]' : 'border-[var(--border-dim)] bg-slate-50'
                      }`}
                    >
                      One-Time Scheduled
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-widest flex items-center gap-1"><Calendar size={13} /> Trigger Date & Time</label>
                  <input
                    type="datetime-local"
                    required
                    value={formDate}
                    onChange={(e) => setFormDate(e.target.value)}
                    className="w-full px-4 py-3 bg-[var(--bg-card)] border border-[var(--border-dim)] rounded-xl text-xs font-semibold outline-none focus:border-blue-500 focus:bg-[var(--bg-card)] transition-all"
                  />
                </div>
              </div>

              <div className="bg-[var(--bg-card)] border border-[var(--border-dim)] rounded-2xl p-4 text-[10px] font-bold text-[var(--text-secondary)] leading-normal flex items-start gap-2.5">
                <AlertCircle className="text-[var(--accent-cyan)] shrink-0 mt-0.5" size={15} />
                <span>
                  By initiating this scheduler, you configure an automated client-side trigger. The payment engine will continuously check current system dates and execute the transfers instantly from your wallet balance when the scheduled time arrives.
                </span>
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-sm tracking-wide uppercase transition-all shadow-md shadow-blue-500/10 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Plus size={16} /> Schedule Payroll Trigger
              </button>

            </form>
          </div>
        )}

        {/* ACTIVE SCHEDULES LIST TAB */}
        {activeTab === 'schedules' && (
          <div className="card rounded-[32px] p-6 sm:p-8 shadow-sm space-y-6">
            <div className="border-b border-[var(--border-dim)] pb-5">
              <h3 className="font-extrabold text-[var(--text-primary)] text-sm">Automated Billing Registry</h3>
              <p className="text-[10px] text-[var(--text-secondary)] font-semibold mt-0.5">Manage automated payroll runs, paused loops, and historical one-time schedules.</p>
            </div>

            {jobs.length === 0 ? (
              <div className="text-center py-16 text-[var(--text-secondary)] space-y-2 border border-dashed border-[var(--border-dim)] rounded-2xl bg-slate-50/50">
                <Clock size={32} className="mx-auto text-slate-200" />
                <p className="text-xs font-black uppercase tracking-wider text-[var(--text-secondary)]">No Automation Jobs Active</p>
                <p className="text-[10px] max-w-xs mx-auto text-slate-450 leading-relaxed font-semibold">Click the Configure tab above to setup a scheduled recurring stablecoin transfer for payrolls or post-dated bills.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-xs font-semibold text-[var(--text-secondary)]">
                  <thead>
                    <tr className="border-b border-[var(--border-dim)] text-[10px] text-[var(--text-secondary)] uppercase tracking-widest font-black">
                      <th className="pb-3 pr-4">Recipient</th>
                      <th className="pb-3 px-4">Amount & Asset</th>
                      <th className="pb-3 px-4">Schedule</th>
                      <th className="pb-3 px-4">Next Trigger</th>
                      <th className="pb-3 px-4">Status</th>
                      <th className="pb-3 pl-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {jobs.map((job) => {
                      const nextDate = new Date(job.executeAt);
                      const isOverdue = nextDate.getTime() <= Date.now();
                      
                      return (
                        <tr key={job.id} className="hover:bg-slate-50/40">
                          {/* Recipient info */}
                          <td className="py-4 pr-4">
                            <div className="flex items-center gap-3">
                              <img src={job.recipientAvatar} className="w-8 h-8 rounded-lg border border-[var(--border-dim)]" alt="" />
                              <div>
                                <span className="font-extrabold text-[var(--text-primary)] block text-xs">@{job.recipientName}</span>
                                <span className="font-mono text-[9px] text-[var(--text-secondary)] block mt-0.5">{job.recipientWallet.slice(0, 8)}...{job.recipientWallet.slice(-6)}</span>
                              </div>
                            </div>
                          </td>

                          {/* Amount */}
                          <td className="py-4 px-4 font-mono font-bold text-[var(--text-primary)] text-xs">
                            {job.amount} {job.asset}
                          </td>

                          {/* Schedule type */}
                          <td className="py-4 px-4">
                            <span className="text-[10px] uppercase font-bold text-slate-650 bg-slate-100 px-2 py-0.5 rounded-md">
                              {job.frequency === 'monthly' ? 'Monthly' : 'One-Time'}
                            </span>
                          </td>

                          {/* Next execution time */}
                          <td className="py-4 px-4">
                            {job.status === 'Executed' ? (
                              <span className="text-[9.5px] text-[var(--text-secondary)] font-bold block">
                                Executed: {job.lastExecutedAt ? new Date(job.lastExecutedAt).toLocaleDateString() : 'N/A'}
                              </span>
                            ) : (
                              <div className="space-y-1">
                                <span className="text-[10px] font-bold text-[var(--text-primary)] block">
                                  {nextDate.toLocaleString()}
                                </span>
                                {job.status === 'Active' && isOverdue && (
                                  <span className="text-[9px] text-amber-600 font-bold bg-amber-50 border border-amber-100 px-1.5 py-0.2 rounded-md uppercase tracking-wider animate-pulse">
                                    Processing...
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* Status Badge */}
                          <td className="py-4 px-4">
                            <span className={`text-[9.5px] font-black uppercase tracking-wider inline-block px-2.5 py-0.5 rounded-full border ${
                              job.status === 'Active'
                                ? 'bg-emerald-50 border-emerald-100 text-emerald-600'
                                : job.status === 'Paused'
                                ? 'bg-slate-50 border-[var(--border-dim)] text-slate-450'
                                : job.status === 'Executed'
                                ? 'bg-[rgba(0,242,254,0.05)] border-[var(--border-dim)] text-[var(--accent-cyan)]'
                                : 'bg-rose-50 border-rose-100 text-rose-600'
                            }`}>
                              {job.status}
                            </span>
                          </td>

                          {/* Actions buttons */}
                          <td className="py-4 pl-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {/* Pause/Resume toggler */}
                              {job.status !== 'Executed' && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleJob(job.id)}
                                  title={job.status === 'Paused' ? 'Resume Autopay' : 'Pause Autopay'}
                                  className="p-2 border border-[var(--border-dim)] text-slate-650 hover:bg-slate-50 rounded-xl cursor-pointer transition-all"
                                >
                                  {job.status === 'Paused' ? <Play size={13} className="text-emerald-500" /> : <Pause size={13} />}
                                </button>
                              )}

                              {/* Force Run instant executor button */}
                              {job.status === 'Active' && (
                                <button
                                  type="button"
                                  onClick={() => handleForceTrigger(job.id)}
                                  title="Trigger payment now for testing"
                                  className="px-2.5 py-2 border border-[var(--border-dim)] bg-[rgba(0,242,254,0.05)] text-[var(--accent-cyan)] text-[10px] font-bold uppercase tracking-wider hover:bg-[rgba(0,242,254,0.05)] rounded-xl cursor-pointer transition-all"
                                >
                                  Trigger Now
                                </button>
                              )}

                              {/* Cancel / Delete job */}
                              <button
                                type="button"
                                onClick={() => handleDeleteJob(job.id)}
                                title="Delete Automation job"
                                className="p-2 border border-[var(--border-dim)] text-rose-500 hover:bg-rose-50 rounded-xl cursor-pointer transition-all"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

      </div>

    </div>
  );
}
