'use client';

import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import {
  CheckCircle, Copy, Loader2, Edit3, Save, ImagePlus,
  X, Globe, PlusCircle, ChevronDown, AlertTriangle,
} from 'lucide-react';

interface RegisteredApp {
  id: string;
  app_name: string;
  app_url: string;
  description: string;
  category: string;
  team_size: number;
  contract_address: string;
  logo_url: string;
  banner_url: string;
  sample_images: string[];
  verification_hash: string;
  is_verified: boolean;
  developer_wallet: string;
}

const MAX_PROJECTS = 10;

function lsKey(addr: string) { return `arcomni_v3_${addr.toLowerCase()}`; }
function lsSave(addr: string, data: RegisteredApp[]) {
  try { localStorage.setItem(lsKey(addr), JSON.stringify(data)); } catch { /**/ }
}
function lsLoad(addr: string): RegisteredApp[] | null {
  try { const r = localStorage.getItem(lsKey(addr)); return r ? JSON.parse(r) : null; } catch { return null; }
}

function toForm(r: RegisteredApp) {
  return {
    appName:          r.app_name          ?? '',
    appUrl:           r.app_url           ?? '',
    description:      r.description       ?? '',
    category:         r.category          ?? '',
    teamSize:         r.team_size?.toString() ?? '1',
    contractAddress:  r.contract_address  ?? '',
    logoUrl:          r.logo_url          ?? '',
    bannerUrl:        r.banner_url        ?? '',
    sampleImages:     Array.isArray(r.sample_images) ? r.sample_images : [],
    verificationHash: r.verification_hash ?? '',
    isVerified:       r.is_verified === true,
  };
}

const EMPTY_FORM = {
  appName:'', appUrl:'', description:'', category:'', teamSize:'1',
  contractAddress:'', logoUrl:'', bannerUrl:'', sampleImages:[] as string[],
  verificationHash:'', isVerified: false,
};

export function AppRegistration() {
  const { address, isConnected } = useAccount();

  // ── Core state ───────────────────────────────────────────────────────────
  const [projects,     setProjects]     = useState<RegisteredApp[]>([]);
  const [activeId,     setActiveId]     = useState<string | null>(null);
  const [form,         setForm]         = useState(EMPTY_FORM);
  const [isLoading,    setIsLoading]    = useState(true);
  const [fetchError,   setFetchError]   = useState('');
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [isEditing,    setIsEditing]    = useState(false);
  const [isRegistering,setIsRegistering]= useState(false);
  const [isVerifying,  setIsVerifying]  = useState(false);
  const [isSaving,     setIsSaving]     = useState(false);
  const [isUploading,  setIsUploading]  = useState(false);
  const [newSampleUrl, setNewSampleUrl] = useState('');

  // ── Load on wallet change ─────────────────────────────────────────────────
  useEffect(() => {
    if (!address) {
      setIsLoading(false); setProjects([]); setActiveId(null); setForm(EMPTY_FORM); return;
    }

    // 1. Show cache instantly
    const cached = lsLoad(address);
    if (cached && cached.length > 0) {
      setProjects(cached);
      setActiveId(cached[0].id);
      setForm(toForm(cached[0]));
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }

    // 2. Fetch fresh from Supabase
    // Capture activeId at the moment the effect runs so the async IIFE can use it
    // without it becoming a reactive dependency (which would cause infinite loops).
    let cancelled = false;
    const capturedActiveId = activeId;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('registered_apps')
          .select('*')
          .eq('developer_wallet', address)
          .order('created_at', { ascending: true });

        if (cancelled) return;
        if (error) throw error;

        const list = (data ?? []) as RegisteredApp[];

        // Merge cached is_verified — never downgrade from verified to unverified
        // (protects against RLS silently returning wrong is_verified value)
        const cached = lsLoad(address);
        const mergedList = list.map(freshItem => {
          const cachedItem = cached?.find(c => c.id === freshItem.id);
          return {
            ...freshItem,
            is_verified: freshItem.is_verified || cachedItem?.is_verified || false,
            logo_url: freshItem.logo_url || cachedItem?.logo_url || '',
            banner_url: freshItem.banner_url || cachedItem?.banner_url || '',
            sample_images: (freshItem.sample_images?.length ? freshItem.sample_images : cachedItem?.sample_images) || [],
          };
        });

        setProjects(mergedList);
        lsSave(address, mergedList);

        if (mergedList.length > 0) {
          // Priority: pick verified project first, then fall back to capturedActiveId, then first
          const verifiedProject = mergedList.find(p => p.is_verified);
          const currentActiveId = capturedActiveId;
          const keepProject = 
            // If there's a currently active project in the list, keep it
            (currentActiveId && mergedList.find(p => p.id === currentActiveId)) ||
            // Otherwise prefer any verified project
            verifiedProject ||
            // Last resort: first project
            mergedList[0];
          setActiveId(keepProject.id);
          setForm(toForm(keepProject));
        } else {
          setActiveId(null);
          setForm(EMPTY_FORM);
        }
      } catch {
        if (!cancelled) {
          setFetchError('Could not load projects. Please refresh.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [address]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Switch project ────────────────────────────────────────────────────────
  const switchProject = (id: string) => {
    const p = projects.find(x => x.id === id);
    if (!p) return;
    setActiveId(id);
    setForm(toForm(p));
    setIsEditing(false);
    setSelectorOpen(false);
  };

  const startNewProject = () => {
    setActiveId(null);
    setForm(EMPTY_FORM);
    setIsEditing(false);
    setSelectorOpen(false);
  };

  // ── Register ──────────────────────────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !address) { toast.error('Connect wallet first'); return; }
    if (projects.length >= MAX_PROJECTS) { toast.error(`Max ${MAX_PROJECTS} projects`); return; }
    setIsRegistering(true);
    try {
      const hash = `arcomni-${Math.random().toString(36).slice(2,15)}-${Date.now()}`;
      const { data, error } = await supabase
        .from('registered_apps')
        .insert({
          developer_wallet: address,
          app_name:   form.appName,
          app_url:    form.appUrl,
          description: form.description,
          category:   form.category,
          team_size:  parseInt(form.teamSize) || 1,
          contract_address: form.contractAddress,
          verification_hash: hash,
          is_verified: false,
        })
        .select().single();
      if (error) throw error;
      const newApp = data as RegisteredApp;
      const updated = [...projects, newApp];
      setProjects(updated);
      lsSave(address, updated);
      setActiveId(newApp.id);
      setForm(toForm(newApp));
      toast.success('Saved! Complete verification below.');
    } catch (err: unknown) {
      toast.error((err as {message?:string}).message ?? 'Failed to register');
    } finally { setIsRegistering(false); }
  };

  // ── Verify ────────────────────────────────────────────────────────────────
  const handleVerify = async () => {
    if (!address || !activeId) return;
    setIsVerifying(true);
    try {
      const res  = await fetch('/api/builder/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appUrl: form.appUrl, hash: form.verificationHash, wallet: address }),
      });
      const json = await res.json();
      if (json.success) {
        const updated = projects.map(p =>
          p.id === activeId ? { ...p, is_verified: true } : p
        );
        setProjects(updated);
        lsSave(address, updated);
        // Apply directly — verified project shows profile view
        const target = updated.find(p => p.id === activeId)!;
        setForm(toForm(target));
        window.dispatchEvent(new CustomEvent('builder-app-verified'));
        toast.success('App Verified!');
      } else {
        toast.error('Verification failed: meta tag not found');
      }
    } catch { toast.error('Verification error'); }
    finally { setIsVerifying(false); }
  };

  // ── Save profile ──────────────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    if (!address || !activeId) return;
    setIsSaving(true);
    try {
      const patch = {
        app_name:         form.appName,
        description:      form.description,
        category:         form.category,
        contract_address: form.contractAddress,
        logo_url:         form.logoUrl,
        banner_url:       form.bannerUrl,
        sample_images:    form.sampleImages,
      };
      const { error } = await supabase.from('registered_apps').update(patch).eq('id', activeId);
      if (error) throw error;
      const updated = projects.map(p => p.id === activeId ? { ...p, ...patch } : p);
      setProjects(updated);
      lsSave(address, updated);
      setIsEditing(false);
      toast.success('Profile saved!');
    } catch (err: unknown) {
      const e = err as {message?:string;details?:string};
      toast.error(e.details ?? e.message ?? 'Save failed');
    } finally { setIsSaving(false); }
  };

  // ── Media upload ──────────────────────────────────────────────────────────
  const uploadFile = async (file: File, path: string) => {
    const { error } = await supabase.storage.from('market_images').upload(path, file, { upsert: true });
    if (error) throw error;
    return supabase.storage.from('market_images').getPublicUrl(path).data.publicUrl;
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo'|'banner'|'sample') => {
    const file = e.target.files?.[0];
    if (!file || !address || !activeId) return;
    setIsUploading(true);
    try {
      const path = `${address.toLowerCase()}/${type}-${Date.now()}-${file.name}`;
      const url  = await uploadFile(file, path);
      let patch: Partial<RegisteredApp> = {};
      if (type === 'logo') {
        setForm(p => ({ ...p, logoUrl: url }));
        patch = { logo_url: url };
      } else if (type === 'banner') {
        setForm(p => ({ ...p, bannerUrl: url }));
        patch = { banner_url: url };
      } else {
        if (form.sampleImages.length >= 5) { toast.error('Max 5 images'); return; }
        const next = [...form.sampleImages, url];
        setForm(p => ({ ...p, sampleImages: next }));
        patch = { sample_images: next };
      }
      await supabase.from('registered_apps').update(patch).eq('id', activeId);
      const updated = projects.map(p => p.id === activeId ? { ...p, ...patch } : p);
      setProjects(updated);
      lsSave(address, updated);
      toast.success('Uploaded!');
    } catch (err: unknown) {
      toast.error((err as {message?:string}).message ?? 'Upload failed');
    } finally { setIsUploading(false); e.target.value = ''; }
  };

  const addSampleUrl = () => {
    if (!newSampleUrl.trim() || form.sampleImages.length >= 5) return;
    setForm(p => ({ ...p, sampleImages: [...p.sampleImages, newSampleUrl.trim()] }));
    setNewSampleUrl('');
  };
  const removeSample = (i: number) => setForm(p => ({ ...p, sampleImages: p.sampleImages.filter((_,j)=>j!==i) }));
  const copyHash = () => { navigator.clipboard.writeText(`<meta name="arcomni-verification" content="${form.verificationHash}">`); toast.success('Copied!'); };

  const activeProject = projects.find(p => p.id === activeId) ?? null;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="bd-card p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-lg font-black" style={{ color: 'var(--bd-accent-gold)' }}>
          Register New Arc Chain App
        </h2>
        {projects.length > 0 && (
          <span className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background:'rgba(245,197,66,0.12)', color:'var(--bd-accent-gold)', border:'1px solid rgba(245,197,66,0.3)' }}>
            {projects.length} / {MAX_PROJECTS} project{projects.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Project selector — only for 2+ projects, prioritize verified ones */}
      {projects.length >= 2 && (
        <div className="mb-4 relative">
          <button onClick={() => setSelectorOpen(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-bold"
            style={{ background:'rgba(0,0,0,0.4)', border:'1px solid rgba(245,197,66,0.2)', color:'#e2e8f0' }}>
            <span className="truncate">{activeProject?.app_name ?? 'Select project…'}</span>
            <ChevronDown size={14} className="flex-shrink-0 ml-2" style={{ color:'var(--bd-accent-gold)' }} />
          </button>
          {selectorOpen && (
            <div className="absolute z-20 left-0 right-0 mt-1 rounded-xl overflow-hidden shadow-2xl"
              style={{ background:'#0f0f1a', border:'1px solid rgba(245,197,66,0.2)' }}>
              {projects.map(p => (
                <button key={p.id} onClick={() => switchProject(p.id)}
                  className="w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 hover:bg-white/5"
                  style={{ color: p.id === activeId ? 'var(--bd-accent-gold)' : '#e2e8f0' }}>
                  {p.is_verified && <CheckCircle size={12} style={{ color:'var(--bd-accent-gold)' }} />}
                  <span className="truncate">{p.app_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Loading skeleton */}
      {isLoading ? (
        <div className="space-y-3 py-4">
          <div className="bd-skeleton h-32 w-full" />
          <div className="bd-skeleton h-6 w-2/3" />
          <div className="bd-skeleton h-6 w-1/2" />
          <div className="bd-skeleton h-10 w-full" />
        </div>

      ) : fetchError ? (
        <div className="flex items-center gap-2 p-3 rounded-xl text-sm"
          style={{ background:'rgba(245,197,66,0.08)', color:'var(--bd-accent-gold)', border:'1px solid rgba(245,197,66,0.2)' }}>
          <AlertTriangle size={16} /> {fetchError}
        </div>

      ) : form.isVerified ? (
        /* ════ VERIFIED PROFILE VIEW ════ */
        <div className="space-y-5">
          {/* Banner + Logo */}
          <div className="relative h-36 rounded-xl overflow-hidden"
            style={{ background:'rgba(245,197,66,0.06)', border:'1px solid rgba(245,197,66,0.15)' }}>
            {form.bannerUrl
              ? <img src={form.bannerUrl} className="w-full h-full object-cover" alt="Banner" />
              : <div className="w-full h-full flex items-center justify-center text-xs" style={{ color:'rgba(245,197,66,0.4)' }}>No Banner Set</div>
            }
            <div className="absolute -bottom-6 left-5">
              <div className="w-14 h-14 rounded-xl overflow-hidden shadow-lg"
                style={{ background:'#0a0a0f', border:'2px solid rgba(245,197,66,0.4)' }}>
                {form.logoUrl
                  ? <img src={form.logoUrl} className="w-full h-full object-cover" alt="Logo" />
                  : <div className="w-full h-full flex items-center justify-center text-base font-black" style={{ color:'var(--bd-accent-gold)' }}>{form.appName?.[0]?.toUpperCase() || '?'}</div>
                }
              </div>
            </div>
            <div className="bd-badge-verified absolute top-3 right-3 px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1">
              <CheckCircle size={11} /> Verified
            </div>
          </div>

          {/* Info + Action Buttons */}
          <div className="pt-5 flex flex-col md:flex-row justify-between items-start gap-3">
            <div className="min-w-0">
              <h3 className="text-base font-black text-white truncate">{form.appName}</h3>
              <a href={form.appUrl} target="_blank" rel="noreferrer"
                className="text-xs flex items-center gap-1 mt-1 hover:underline truncate"
                style={{ color:'var(--bd-accent-gold)' }}>
                <Globe size={11} /> {form.appUrl}
              </a>
              {form.description && <p className="text-xs text-slate-400 mt-1 leading-relaxed max-w-sm">{form.description}</p>}
            </div>
            <div className="flex flex-wrap gap-2 flex-shrink-0">
              {/* Edit Profile button */}
              <button onClick={() => setIsEditing(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={isEditing
                  ? { background:'rgba(245,197,66,0.1)', color:'var(--bd-accent-gold)', border:'1px solid rgba(245,197,66,0.3)' }
                  : { background:'rgba(245,197,66,0.08)', color:'var(--bd-accent-gold)', border:'1px solid rgba(245,197,66,0.2)' }}>
                {isEditing ? <><X size={12} /> Cancel</> : <><Edit3 size={12} /> Edit Profile</>}
              </button>
              {/* Register New App button */}
              <button onClick={startNewProject}
                disabled={projects.length >= MAX_PROJECTS}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background:'rgba(192,132,252,0.1)', color:'var(--bd-accent-purple)', border:'1px solid rgba(192,132,252,0.2)' }}
                title={projects.length >= MAX_PROJECTS ? `Max ${MAX_PROJECTS} projects` : 'Register a new project'}>
                <PlusCircle size={12} /> Register New App
              </button>
            </div>
          </div>

          {/* Screenshots view */}
          {!isEditing && form.sampleImages.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color:'rgba(245,197,66,0.5)' }}>
                Sample Screenshots
              </p>
              <div className="bd-img-scroll">
                {form.sampleImages.map((url, i) => (
                  <img key={i} src={url} className="h-24 flex-shrink-0 rounded-lg object-cover"
                    style={{ border:'1px solid rgba(245,197,66,0.15)' }} alt={`S${i+1}`} />
                ))}
              </div>
            </div>
          )}

          {/* Edit form */}
          {isEditing && (
            <div className="space-y-4 p-4 rounded-2xl"
              style={{ background:'rgba(0,0,0,0.4)', border:'1px solid rgba(245,197,66,0.15)' }}>
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color:'var(--bd-accent-gold)' }}>App Name</label>
                <input className="bd-input" type="text" value={form.appName}
                  onChange={e => setForm(p => ({ ...p, appName: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color:'var(--bd-accent-gold)' }}>Description</label>
                <textarea className="bd-input" value={form.description} rows={3}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1" style={{ color:'var(--bd-accent-gold)' }}>Category</label>
                  <input className="bd-input" type="text" value={form.category} placeholder="DeFi, NFT…"
                    onChange={e => setForm(p => ({ ...p, category: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1" style={{ color:'var(--bd-accent-gold)' }}>Contract Address</label>
                  <input className="bd-input" type="text" value={form.contractAddress} placeholder="0x…"
                    onChange={e => setForm(p => ({ ...p, contractAddress: e.target.value }))} />
                </div>
              </div>
              <hr style={{ borderColor:'rgba(245,197,66,0.1)' }} />
              {/* Logo */}
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color:'var(--bd-accent-gold)' }}>Logo</label>
                <input type="file" accept="image/*" onChange={e => handleMediaUpload(e,'logo')}
                  className="block w-full text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:font-bold file:cursor-pointer file:bg-[rgba(245,197,66,0.1)] file:text-[#f5c542]" />
                <input className="bd-input mt-2" type="url" value={form.logoUrl} placeholder="https://…/logo.png"
                  onChange={e => setForm(p => ({ ...p, logoUrl: e.target.value }))} />
              </div>
              {/* Banner */}
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color:'var(--bd-accent-gold)' }}>Banner</label>
                <input type="file" accept="image/*" onChange={e => handleMediaUpload(e,'banner')}
                  className="block w-full text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:font-bold file:cursor-pointer file:bg-[rgba(245,197,66,0.1)] file:text-[#f5c542]" />
                <input className="bd-input mt-2" type="url" value={form.bannerUrl} placeholder="https://…/banner.jpg"
                  onChange={e => setForm(p => ({ ...p, bannerUrl: e.target.value }))} />
              </div>
              {/* Screenshots */}
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color:'var(--bd-accent-gold)' }}>
                  Sample Screenshots <span className="opacity-50">(max 5)</span>
                </label>
                <div className="flex gap-2 mb-2">
                  <input type="file" accept="image/*" onChange={e => handleMediaUpload(e,'sample')}
                    className="block w-full text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:font-bold file:cursor-pointer file:bg-[rgba(245,197,66,0.1)] file:text-[#f5c542]" />
                  <input className="bd-input" type="url" value={newSampleUrl} placeholder="or paste URL"
                    onChange={e => setNewSampleUrl(e.target.value)} />
                  <button onClick={addSampleUrl} className="bd-btn-primary px-3 rounded-lg flex-shrink-0 flex items-center gap-1 text-xs">
                    <ImagePlus size={14} />
                  </button>
                </div>
                {form.sampleImages.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {form.sampleImages.map((url, i) => (
                      <div key={i} className="relative group">
                        <img src={url} className="h-16 w-24 rounded-lg object-cover"
                          style={{ border:'1px solid rgba(245,197,66,0.15)' }} alt="" />
                        <button onClick={() => removeSample(i)}
                          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[8px] opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ background:'#f5c542', color:'#0a0a0f' }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={handleSaveProfile} disabled={isSaving || isUploading}
                className="bd-btn-primary w-full py-3 rounded-xl flex justify-center items-center gap-2 text-sm">
                {isSaving || isUploading
                  ? <><Loader2 className="animate-spin w-4 h-4" />{isUploading ? 'Uploading…' : 'Saving…'}</>
                  : <><Save size={15} /> Save Profile</>}
              </button>
            </div>
          )}
        </div>

      ) : !form.verificationHash ? (
        /* ════ REGISTRATION FORM (only when no hash yet) ════ */
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-xs font-bold mb-1" style={{ color:'var(--bd-accent-gold)' }}>App Name</label>
            <input required className="bd-input" type="text" value={form.appName}
              onChange={e => setForm(p => ({ ...p, appName: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1" style={{ color:'var(--bd-accent-gold)' }}>Website URL</label>
            <input required className="bd-input" type="url" value={form.appUrl} placeholder="https://myapp.com"
              onChange={e => setForm(p => ({ ...p, appUrl: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1" style={{ color:'var(--bd-accent-gold)' }}>Description</label>
            <textarea className="bd-input" value={form.description} rows={3}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1" style={{ color:'var(--bd-accent-gold)' }}>
              Contract Address <span className="opacity-50">(optional)</span>
            </label>
            <input className="bd-input" type="text" value={form.contractAddress} placeholder="0x…"
              onChange={e => setForm(p => ({ ...p, contractAddress: e.target.value }))} />
          </div>
          <button disabled={isRegistering} type="submit"
            className="bd-btn-primary w-full py-2.5 rounded-xl flex justify-center items-center gap-2 text-sm">
            {isRegistering ? <Loader2 className="animate-spin w-4 h-4" /> : 'Generate Metadata Tag'}
          </button>
        </form>

      ) : (
        /* ════ VERIFICATION SCREEN (only when hash exists but NOT verified) ════ */
        <div className="space-y-5">
          <div className="p-4 rounded-xl space-y-2"
            style={{ background:'rgba(0,0,0,0.4)', border:'1px solid rgba(245,197,66,0.15)' }}>
            <h3 className="text-sm font-bold" style={{ color:'var(--bd-accent-gold)' }}>
              Step 1: Add this meta tag to your &lt;head&gt;
            </h3>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-2 rounded text-xs overflow-x-auto"
                style={{ background:'#000', color:'var(--bd-accent-gold)' }}>
                {`<meta name="arcomni-verification" content="${form.verificationHash}">`}
              </code>
              <button onClick={copyHash} className="p-2 rounded-lg flex-shrink-0"
                style={{ background:'rgba(245,197,66,0.1)', color:'var(--bd-accent-gold)', border:'1px solid rgba(245,197,66,0.2)' }}>
                <Copy size={15} />
              </button>
            </div>
          </div>
          <div className="p-4 rounded-xl space-y-2"
            style={{ background:'rgba(0,0,0,0.4)', border:'1px solid rgba(245,197,66,0.15)' }}>
            <h3 className="text-sm font-bold" style={{ color:'var(--bd-accent-gold)' }}>Step 2: Verify Configuration</h3>
            <button onClick={handleVerify} disabled={isVerifying}
              className="bd-btn-primary w-full py-2.5 rounded-xl flex justify-center items-center gap-2 text-sm">
              {isVerifying ? <Loader2 className="animate-spin w-4 h-4" /> : 'Verify Now'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
