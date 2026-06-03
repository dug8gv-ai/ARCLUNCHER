'use client';

import React, { useState } from 'react';
import { useAccount } from 'wagmi';
import { supabase } from '@/lib/supabase'; // Ensure this client exists
import { createClient } from '@supabase/supabase-js';
import toast from 'react-hot-toast';
import { CheckCircle, AlertCircle, Copy, Loader2 } from 'lucide-react';

export function AppRegistration() {
  const { address, isConnected } = useAccount();
  const [formData, setFormData] = useState({
    appName: '',
    appUrl: '',
    description: '',
    category: '',
    teamSize: '1',
    contractAddress: '',
  });
  const [verificationHash, setVerificationHash] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !address) {
      toast.error('Connect your wallet first');
      return;
    }

    try {
      setIsRegistering(true);
      // Generate a unique hash for the meta tag
      const hash = `arcomni-${Math.random().toString(36).substring(2, 15)}-${Date.now()}`;
      
      const { error } = await supabase
        .from('registered_apps')
        .insert({
          developer_wallet: address,
          app_name: formData.appName,
          app_url: formData.appUrl,
          description: formData.description,
          category: formData.category,
          team_size: parseInt(formData.teamSize),
          contract_address: formData.contractAddress,
          verification_hash: hash,
          is_verified: false
        });

      if (error) throw error;
      
      setVerificationHash(hash);
      toast.success('Project saved! Please complete verification.');
    } catch (error: any) {
      toast.error(error.message || 'Failed to register app');
    } finally {
      setIsRegistering(false);
    }
  };

  const handleVerify = async () => {
    try {
      setIsVerifying(true);
      const res = await fetch('/api/builder/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appUrl: formData.appUrl, hash: verificationHash, wallet: address })
      });
      const data = await res.json();
      
      if (data.success) {
        setIsVerified(true);
        toast.success('App Verified Successfully!');
      } else {
        toast.error('Verification failed: Meta tag not found');
      }
    } catch (error: any) {
      toast.error('Error during verification');
    } finally {
      setIsVerifying(false);
    }
  };

  const copyToClipboard = () => {
    const metaTag = `<meta name="arcomni-verification" content="${verificationHash}">`;
    navigator.clipboard.writeText(metaTag);
    toast.success('Copied to clipboard!');
  };

  return (
    <div className="bg-[#0d0e1c] p-6 rounded-2xl border border-[var(--border-dim)]">
      <h2 className="text-xl font-bold text-cyan-400 mb-6">Register New Arc Chain App</h2>
      
      {!verificationHash ? (
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1">App Name</label>
            <input required type="text" value={formData.appName} onChange={e => setFormData({...formData, appName: e.target.value})} className="w-full bg-[#090a12] border border-[var(--border-dim)] rounded-lg p-2 text-white" />
          </div>
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1">Website URL</label>
            <input required type="url" value={formData.appUrl} onChange={e => setFormData({...formData, appUrl: e.target.value})} className="w-full bg-[#090a12] border border-[var(--border-dim)] rounded-lg p-2 text-white" placeholder="https://myapp.com" />
          </div>
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1">Description</label>
            <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full bg-[#090a12] border border-[var(--border-dim)] rounded-lg p-2 text-white" rows={3}></textarea>
          </div>
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1">Arc Chain Contract Address (Optional)</label>
            <input type="text" value={formData.contractAddress} onChange={e => setFormData({...formData, contractAddress: e.target.value})} className="w-full bg-[#090a12] border border-[var(--border-dim)] rounded-lg p-2 text-white" placeholder="0x..." />
          </div>
          <button disabled={isRegistering} type="submit" className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 rounded-lg transition-all flex justify-center items-center">
            {isRegistering ? <Loader2 className="animate-spin w-5 h-5" /> : 'Generate Metadata Tag'}
          </button>
        </form>
      ) : (
        <div className="space-y-6">
          <div className="p-4 bg-slate-800/50 rounded-xl border border-[var(--border-dim)]">
            <h3 className="text-sm text-slate-300 font-bold mb-2">Step 1: Add this meta tag to your &lt;head&gt;</h3>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-black p-2 rounded text-cyan-300 text-xs overflow-x-auto">
                &lt;meta name="arcomni-verification" content="{verificationHash}"&gt;
              </code>
              <button onClick={copyToClipboard} className="p-2 bg-slate-700 hover:bg-slate-600 rounded text-white">
                <Copy size={16} />
              </button>
            </div>
          </div>

          <div className="p-4 bg-slate-800/50 rounded-xl border border-[var(--border-dim)]">
            <h3 className="text-sm text-slate-300 font-bold mb-2">Step 2: Verify Configuration</h3>
            <button 
              onClick={handleVerify} 
              disabled={isVerifying || isVerified}
              className={`w-full py-2 rounded-lg font-bold flex justify-center items-center gap-2 transition-all ${isVerified ? 'bg-green-600/20 text-green-400 border border-green-500' : 'bg-cyan-600 hover:bg-cyan-500 text-white'}`}
            >
              {isVerifying ? <Loader2 className="animate-spin w-5 h-5" /> : isVerified ? <><CheckCircle size={18}/> Verified</> : 'Verify Now'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
