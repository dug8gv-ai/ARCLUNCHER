'use client';

import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { CheckCircle, Copy, Loader2, Edit3, Save, ImagePlus, X, ExternalLink, Globe } from 'lucide-react';

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
  const [profileData, setProfileData] = useState({
    logoUrl: '',
    bannerUrl: '',
    sampleImages: [] as string[],
  });
  const [newSampleUrl, setNewSampleUrl] = useState('');
  const [verificationHash, setVerificationHash] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [existingApp, setExistingApp] = useState<any>(null);
  const [isLoadingState, setIsLoadingState] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!address) {
      setIsLoadingState(false);
      return;
    }

    const fetchExistingApp = async () => {
      try {
        const { data, error } = await supabase
          .from('registered_apps')
          .select('*')
          .eq('developer_wallet', address)
          .single();
        
        if (data) {
          setExistingApp(data);
          setFormData({
            appName: data.app_name || '',
            appUrl: data.app_url || '',
            description: data.description || '',
            category: data.category || '',
            teamSize: data.team_size?.toString() || '1',
            contractAddress: data.contract_address || '',
          });
          setProfileData({
            logoUrl: data.logo_url || '',
            bannerUrl: data.banner_url || '',
            sampleImages: data.sample_images || [],
          });
          setVerificationHash(data.verification_hash || '');
          setIsVerified(data.is_verified || false);
        }
      } catch (err) {
        console.error("Error fetching app", err);
      } finally {
        setIsLoadingState(false);
      }
    };

    fetchExistingApp();
  }, [address]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !address) {
      toast.error('Connect your wallet first');
      return;
    }

    try {
      setIsRegistering(true);
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
        window.dispatchEvent(new CustomEvent('builder-app-verified'));
        toast.success('App Verified Successfully!');
        if (existingApp) {
          setExistingApp({ ...existingApp, is_verified: true });
        }
      } else {
        toast.error('Verification failed: Meta tag not found');
      }
    } catch (error: any) {
      toast.error('Error during verification');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!address || !existingApp) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('registered_apps')
        .update({
          app_name: formData.appName,
          description: formData.description,
          category: formData.category,
          contract_address: formData.contractAddress,
          logo_url: profileData.logoUrl,
          banner_url: profileData.bannerUrl,
          sample_images: profileData.sampleImages,
        })
        .eq('developer_wallet', address);

      if (error) throw error;
      
      setExistingApp({
        ...existingApp,
        app_name: formData.appName,
        description: formData.description,
        category: formData.category,
        contract_address: formData.contractAddress,
        logo_url: profileData.logoUrl,
        banner_url: profileData.bannerUrl,
        sample_images: profileData.sampleImages,
      });
      setIsEditing(false);
      toast.success('Profile updated successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const addSampleImage = () => {
    if (!newSampleUrl.trim()) return;
    if (profileData.sampleImages.length >= 5) {
      toast.error('Maximum 5 sample images allowed');
      return;
    }
    setProfileData(prev => ({
      ...prev,
      sampleImages: [...prev.sampleImages, newSampleUrl.trim()]
    }));
    setNewSampleUrl('');
  };

  const removeSampleImage = (index: number) => {
    setProfileData(prev => ({
      ...prev,
      sampleImages: prev.sampleImages.filter((_, i) => i !== index)
    }));
  };

  const copyToClipboard = () => {
    const metaTag = `<meta name="arcomni-verification" content="${verificationHash}">`;
    navigator.clipboard.writeText(metaTag);
    toast.success('Copied to clipboard!');
  };

  // INPUT STYLE (reusable)
  const inputClass = "w-full bg-[#090a12] border border-[var(--border-dim)] rounded-lg p-2.5 text-white text-sm focus:border-cyan-500/50 outline-none transition-colors";

  return (
    <div className="bg-[#0d0e1c] p-6 rounded-2xl border border-[var(--border-dim)]">
      <h2 className="text-xl font-bold text-cyan-400 mb-6">Register New Arc Chain App</h2>
      
      {isLoadingState ? (
        <div className="flex justify-center items-center py-10">
          <Loader2 className="animate-spin text-cyan-400" size={32} />
        </div>

      ) : isVerified ? (
        /* ======= VERIFIED: Profile Dashboard ======= */
        <div className="space-y-6">
          
          {/* Banner Preview */}
          <div className="relative h-36 rounded-xl overflow-hidden bg-gradient-to-r from-cyan-900/30 to-blue-900/30 border border-[var(--border-dim)]">
            {profileData.bannerUrl ? (
              <img src={profileData.bannerUrl} className="w-full h-full object-cover" alt="Banner" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-500 text-xs">No Banner Set</div>
            )}
            {/* Logo overlay */}
            <div className="absolute -bottom-6 left-5">
              <div className="w-16 h-16 rounded-xl bg-[#0d0e1c] border-2 border-[var(--border-dim)] overflow-hidden shadow-lg">
                {profileData.logoUrl ? (
                  <img src={profileData.logoUrl} className="w-full h-full object-cover" alt="Logo" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-cyan-900/20 text-cyan-400 text-lg font-black">
                    {formData.appName?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
              </div>
            </div>
            {/* Verified Badge */}
            <div className="absolute top-3 right-3 bg-green-500/20 backdrop-blur text-green-400 px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 border border-green-500/30">
              <CheckCircle size={12} /> Verified
            </div>
          </div>

          {/* Info / Header */}
          <div className="pt-4 flex justify-between items-start">
            <div>
              <h3 className="text-lg font-black text-white">{formData.appName}</h3>
              <a href={formData.appUrl} target="_blank" rel="noreferrer" className="text-xs text-cyan-400 flex items-center gap-1 mt-1 hover:underline">
                <Globe size={11} /> {formData.appUrl}
              </a>
              {formData.description && (
                <p className="text-xs text-slate-400 mt-2 leading-relaxed max-w-md">{formData.description}</p>
              )}
            </div>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                isEditing
                  ? 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20'
                  : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/20'
              }`}
            >
              {isEditing ? <><X size={12} /> Cancel</> : <><Edit3 size={12} /> Edit Profile</>}
            </button>
          </div>

          {/* Sample Images Gallery (View Only) */}
          {!isEditing && profileData.sampleImages.length > 0 && (
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Sample Screenshots</p>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {profileData.sampleImages.map((url, i) => (
                  <img key={i} src={url} className="h-24 rounded-lg object-cover border border-[var(--border-dim)]" alt={`Sample ${i+1}`} />
                ))}
              </div>
            </div>
          )}

          {/* ======= EDIT FORM ======= */}
          {isEditing && (
            <div className="space-y-4 p-5 bg-[rgba(6,8,20,0.5)] border border-[var(--border-dim)] rounded-2xl">
              <div>
                <label className="block text-xs text-slate-400 mb-1 font-bold">App Name</label>
                <input type="text" value={formData.appName} onChange={e => setFormData({...formData, appName: e.target.value})} className={inputClass} />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1 font-bold">Description</label>
                <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className={inputClass} rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-slate-400 mb-1 font-bold">Category</label>
                  <input type="text" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className={inputClass} placeholder="DeFi, NFT, etc." />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1 font-bold">Contract Address</label>
                  <input type="text" value={formData.contractAddress} onChange={e => setFormData({...formData, contractAddress: e.target.value})} className={inputClass} placeholder="0x..." />
                </div>
              </div>

              <hr className="border-[var(--border-dim)]" />

              <div>
                <label className="block text-xs text-slate-400 mb-1 font-bold">Logo URL</label>
                <input type="url" value={profileData.logoUrl} onChange={e => setProfileData({...profileData, logoUrl: e.target.value})} className={inputClass} placeholder="https://example.com/logo.png" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1 font-bold">Banner URL</label>
                <input type="url" value={profileData.bannerUrl} onChange={e => setProfileData({...profileData, bannerUrl: e.target.value})} className={inputClass} placeholder="https://example.com/banner.jpg" />
              </div>

              {/* Sample Images */}
              <div>
                <label className="block text-xs text-slate-400 mb-1 font-bold">Sample Screenshots (max 5)</label>
                <div className="flex gap-2 mb-2">
                  <input type="url" value={newSampleUrl} onChange={e => setNewSampleUrl(e.target.value)} className={`${inputClass} flex-1`} placeholder="https://example.com/screenshot.png" />
                  <button onClick={addSampleImage} className="bg-cyan-600 hover:bg-cyan-500 text-white px-3 rounded-lg text-xs font-bold transition-colors flex items-center gap-1">
                    <ImagePlus size={14} /> Add
                  </button>
                </div>
                {profileData.sampleImages.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {profileData.sampleImages.map((url, i) => (
                      <div key={i} className="relative group">
                        <img src={url} className="h-16 w-24 rounded-lg object-cover border border-[var(--border-dim)]" alt="" />
                        <button 
                          onClick={() => removeSampleImage(i)} 
                          className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-[8px] opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-3 rounded-lg transition-all flex justify-center items-center gap-2"
              >
                {isSaving ? <Loader2 className="animate-spin w-4 h-4" /> : <Save size={16} />}
                {isSaving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          )}
        </div>

      ) : !verificationHash ? (
        /* ======= REGISTRATION FORM ======= */
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1">App Name</label>
            <input required type="text" value={formData.appName} onChange={e => setFormData({...formData, appName: e.target.value})} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1">Website URL</label>
            <input required type="url" value={formData.appUrl} onChange={e => setFormData({...formData, appUrl: e.target.value})} className={inputClass} placeholder="https://myapp.com" />
          </div>
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1">Description</label>
            <textarea value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className={inputClass} rows={3}></textarea>
          </div>
          <div>
            <label className="block text-sm text-[var(--text-secondary)] mb-1">Arc Chain Contract Address (Optional)</label>
            <input type="text" value={formData.contractAddress} onChange={e => setFormData({...formData, contractAddress: e.target.value})} className={inputClass} placeholder="0x..." />
          </div>
          <button disabled={isRegistering} type="submit" className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 rounded-lg transition-all flex justify-center items-center">
            {isRegistering ? <Loader2 className="animate-spin w-5 h-5" /> : 'Generate Metadata Tag'}
          </button>
        </form>

      ) : (
        /* ======= VERIFICATION STEPS ======= */
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
