'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import {
  CheckCircle, Copy, Loader2, Edit3, Save, ImagePlus,
  X, Globe, PlusCircle, ChevronDown, AlertTriangle,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
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

const EMPTY_FORM = {
  appName: '', appUrl: '', description: '',
  category: '', teamSize: '1', contractAddress: '',
};

const EMPTY_PROFILE = { logoUrl: '', bannerUrl: '', sampleImages: [] as string[] };

const MAX_PROJECTS = 10;

// ─── localStorage helpers ─────────────────────────────────────────────────────
function lsKey(address: string) {
  return `arcomni_builder_project_${address.toLowerCase()}`;
}
function lsSave(address: string, data: Record<string, unknown>) {
  try { localStorage.setItem(lsKey(address), JSON.stringify(data)); } catch { /* quota / SSR */ }
}
function lsLoad(address: string): Record<string, unknown> | null {
  try {
    const raw = localStorage.getItem(lsKey(address));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// ─── Component ────────────────────────────────────────────────────────────────
export function AppRegistration() {
  const { address, isConnected } = useAccount();

  // project list
  const [projects, setProjects] = useState<RegisteredApp[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);

  // form / profile state
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [profileData, setProfileData] = useState(EMPTY_PROFILE);
  const [verificationHash, setVerificationHash] = useState('');
  const [isVerified, setIsVerified] = useState(false);

  // UI flags
  const [isLoadingState, setIsLoadingState] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [newSampleUrl, setNewSampleUrl] = useState('');

  // ── Load all projects for wallet ─────────────────────────────────────────
  const loadProjects = useCallback(async (addr: string) => {
    setIsLoadingState(true);
    setFetchError('');

    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 10_000)
    );

    try {
      const supabaseQuery = supabase
        .from('registered_apps')
        .select('*')
        .eq('developer_wallet', addr)
        .order('created_at', { ascending: true });

      const result = await Promise.race([supabaseQuery, timeout]);
      const { data, error } = result as { data: RegisteredApp[] | null; error: unknown };

      if (error) throw error;

      const list = (data ?? []) as RegisteredApp[];
      setProjects(list);

      if (list.length > 0) {
        const first = list[0];
        setActiveProjectId(first.id);

        // ── Inline apply (avoids stale closure from applyProject ref) ──
        setFormData({
          appName: first.app_name ?? '',
          appUrl: first.app_url ?? '',
          description: first.description ?? '',
          category: first.category ?? '',
          teamSize: first.team_size?.toString() ?? '1',
          contractAddress: first.contract_address ?? '',
        });
        setProfileData({
          logoUrl: first.logo_url ?? '',
          bannerUrl: first.banner_url ?? '',
          sampleImages: first.sample_images ?? [],
        });
        setVerificationHash(first.verification_hash ?? '');
        setIsVerified(first.is_verified ?? false);
        setIsEditing(false);

        // Supabase is authoritative — overwrite localStorage
        lsSave(addr, first as unknown as Record<string, unknown>);
      } else {
        // No projects — show blank form
        setFormData(EMPTY_FORM);
        setProfileData(EMPTY_PROFILE);
        setVerificationHash('');
        setIsVerified(false);
        setIsEditing(false);
      }
    } catch {
      setFetchError('Could not load your projects. Please refresh.');
      setProjects([]);
      setFormData(EMPTY_FORM);
      setProfileData(EMPTY_PROFILE);
      setVerificationHash('');
      setIsVerified(false);
    } finally {
      setIsLoadingState(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!address) {
      setIsLoadingState(false);
      setProjects([]);
      setActiveProjectId(null);
      resetForm();
      return;
    }
    loadProjects(address);
  }, [address, loadProjects]);

  // ── Apply a project to local form state ──────────────────────────────────
  const applyProject = (p: RegisteredApp) => {
    setFormData({
      appName: p.app_name ?? '',
      appUrl: p.app_url ?? '',
      description: p.description ?? '',
      category: p.category ?? '',
      teamSize: p.team_size?.toString() ?? '1',
      contractAddress: p.contract_address ?? '',
    });
    setProfileData({
      logoUrl: p.logo_url ?? '',
      bannerUrl: p.banner_url ?? '',
      sampleImages: p.sample_images ?? [],
    });
    setVerificationHash(p.verification_hash ?? '');
    setIsVerified(p.is_verified ?? false);
    setIsEditing(false);
  };

  const resetForm = () => {
    setFormData(EMPTY_FORM);
    setProfileData(EMPTY_PROFILE);
    setVerificationHash('');
    setIsVerified(false);
    setIsEditing(false);
  };

  // ── Switch active project ─────────────────────────────────────────────────
  const switchProject = (id: string) => {
    const p = projects.find(x => x.id === id);
    if (!p) return;
    setActiveProjectId(id);
    applyProject(p);
    setSelectorOpen(false);
  };

  // ── Start registering a new project ───────────────────────────────────────
  const startNewProject = () => {
    setActiveProjectId(null);
    resetForm();
    setSelectorOpen(false);
  };

  // ── Register new app ─────────────────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !address) { toast.error('Connect your wallet first'); return; }
    if (projects.length >= MAX_PROJECTS) { toast.error(`Maximum ${MAX_PROJECTS} projects allowed`); return; }

    setIsRegistering(true);
    try {
      const hash = `arcomni-${Math.random().toString(36).substring(2, 15)}-${Date.now()}`;

      const { data, error } = await supabase
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
          is_verified: false,
        })
        .select()
        .single();

      if (error) throw error;

      const newApp = data as RegisteredApp;
      setProjects(prev => [...prev, newApp]);
      setActiveProjectId(newApp.id);
      setVerificationHash(hash);
      toast.success('Project saved! Complete verification below.');
    } catch (err: unknown) {
      toast.error((err as { message?: string }).message || 'Failed to register app');
    } finally {
      setIsRegistering(false);
    }
  };

  // ── Verify ────────────────────────────────────────────────────────────────
  const handleVerify = async () => {
    setIsVerifying(true);
    try {
      const res = await fetch('/api/builder/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appUrl: formData.appUrl, hash: verificationHash, wallet: address }),
      });
      const result = await res.json();

      if (result.success) {
        setIsVerified(true);

        // Update projects array
        setProjects(prev =>
          prev.map(p => p.id === activeProjectId ? { ...p, is_verified: true } : p)
        );

        // Persist to localStorage
        if (address) {
          const cached = lsLoad(address) ?? {};
          lsSave(address, { ...cached, is_verified: true, verification_hash: verificationHash });
        }

        window.dispatchEvent(new CustomEvent('builder-app-verified'));
        toast.success('App Verified Successfully!');
      } else {
        toast.error('Verification failed: Meta tag not found');
      }
    } catch {
      toast.error('Error during verification');
    } finally {
      setIsVerifying(false);
    }
  };

  // ── Save profile ──────────────────────────────────────────────────────────
  const handleSaveProfile = async () => {
    if (!address || !activeProjectId) return;
    setIsSaving(true);
    try {
      const updates = {
        app_name:         formData.appName,
        description:      formData.description,
        category:         formData.category,
        contract_address: formData.contractAddress,
        logo_url:         profileData.logoUrl   || '',
        banner_url:       profileData.bannerUrl || '',
        sample_images:    profileData.sampleImages,
      };

      const { error } = await supabase
        .from('registered_apps')
        .update(updates)
        .eq('id', activeProjectId);

      if (error) throw error;

      // Update local projects array
      setProjects(prev =>
        prev.map(p => p.id === activeProjectId ? { ...p, ...updates } : p)
      );

      // Sync localStorage
      const existing = lsLoad(address) ?? {};
      lsSave(address, { ...existing, ...updates });

      setIsEditing(false);
      toast.success('Profile saved!');
    } catch (err: unknown) {
      const msg = (err as { message?: string; details?: string }).message || 'Failed to save';
      const detail = (err as { details?: string }).details || '';
      toast.error(detail ? `${msg}: ${detail}` : msg);
    } finally {
      setIsSaving(false);
    }
  };

  // ── Media upload ──────────────────────────────────────────────────────────
  const uploadMediaToBucket = async (file: File, path: string) => {
    const { error } = await supabase.storage
      .from('market_images')
      .upload(path, file, { upsert: true });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage
      .from('market_images')
      .getPublicUrl(path);
    return publicUrl;
  };

  const persistMediaData = async (updatedData: Partial<typeof profileData>) => {
    if (!address || !activeProjectId) return;
    // Use only the explicitly passed fields — do NOT read profileData from closure
    const patch: Record<string, unknown> = {};
    if (updatedData.logoUrl   !== undefined) patch.logo_url       = updatedData.logoUrl;
    if (updatedData.bannerUrl !== undefined) patch.banner_url     = updatedData.bannerUrl;
    if (updatedData.sampleImages !== undefined) patch.sample_images = updatedData.sampleImages;

    const { error } = await supabase
      .from('registered_apps')
      .update(patch)
      .eq('id', activeProjectId);
    if (error) throw error;
  };

  const handleMediaUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
    type: 'logo' | 'banner' | 'sample'
  ) => {
    const file = event.target.files?.[0];
    if (!file || !address) return;
    setIsUploadingMedia(true);
    try {
      const path = `${address.toLowerCase()}/${type}-${Date.now()}-${file.name}`;
      const publicUrl = await uploadMediaToBucket(file, path);

      if (type === 'logo') {
        const next = { ...profileData, logoUrl: publicUrl };
        setProfileData(next);
        await persistMediaData({ logoUrl: publicUrl });
      } else if (type === 'banner') {
        const next = { ...profileData, bannerUrl: publicUrl };
        setProfileData(next);
        await persistMediaData({ bannerUrl: publicUrl });
      } else {
        if (profileData.sampleImages.length >= 5) { toast.error('Max 5 sample images'); return; }
        const nextImages = [...profileData.sampleImages, publicUrl];
        setProfileData(prev => ({ ...prev, sampleImages: nextImages }));
        await persistMediaData({ sampleImages: nextImages });
      }
      toast.success('Image uploaded!');
    } catch (err: unknown) {
      toast.error((err as { message?: string }).message || 'Upload failed');
    } finally {
      setIsUploadingMedia(false);
      event.target.value = '';
    }
  };

  const addSampleImageUrl = () => {
    if (!newSampleUrl.trim()) return;
    if (profileData.sampleImages.length >= 5) { toast.error('Max 5 sample images'); return; }
    setProfileData(prev => ({ ...prev, sampleImages: [...prev.sampleImages, newSampleUrl.trim()] }));
    setNewSampleUrl('');
  };

  const removeSampleImage = (index: number) => {
    setProfileData(prev => ({
      ...prev,
      sampleImages: prev.sampleImages.filter((_, i) => i !== index),
    }));
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(
      `<meta name="arcomni-verification" content="${verificationHash}">`
    );
    toast.success('Copied!');
  };

  // ── Active project object ─────────────────────────────────────────────────
  const activeProject = projects.find(p => p.id === activeProjectId);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="bd-card p-6">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h2 className="text-lg font-black" style={{ color: 'var(--bd-accent-gold)' }}>
          Register New Arc Chain App
        </h2>
        {/* Project count badge */}
        {projects.length > 0 && (
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full"
            style={{ background: 'rgba(245,197,66,0.12)', color: 'var(--bd-accent-gold)', border: '1px solid rgba(245,197,66,0.3)' }}
          >
            {projects.length} / {MAX_PROJECTS} project{projects.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* ── Project selector ── */}
      {projects.length >= 2 && (
        <div className="mb-4 relative">
          <button
            onClick={() => setSelectorOpen(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-bold"
            style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(245,197,66,0.2)', color: '#e2e8f0' }}
          >
            <span className="truncate">{activeProject?.app_name ?? 'Select project…'}</span>
            <ChevronDown size={14} className="flex-shrink-0 ml-2" style={{ color: 'var(--bd-accent-gold)' }} />
          </button>
          {selectorOpen && (
            <div
              className="absolute z-20 left-0 right-0 mt-1 rounded-xl overflow-hidden shadow-2xl"
              style={{ background: '#0f0f1a', border: '1px solid rgba(245,197,66,0.2)' }}
            >
              {projects.map(p => (
                <button
                  key={p.id}
                  onClick={() => switchProject(p.id)}
                  className="w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 hover:bg-white/5 transition-colors"
                  style={{ color: p.id === activeProjectId ? 'var(--bd-accent-gold)' : '#e2e8f0' }}
                >
                  {p.is_verified && <CheckCircle size={12} style={{ color: 'var(--bd-accent-gold)' }} />}
                  <span className="truncate">{p.app_name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Loading skeleton ── */}
      {isLoadingState ? (
        <div className="space-y-3 py-4">
          <div className="bd-skeleton h-32 w-full" />
          <div className="bd-skeleton h-6 w-2/3" />
          <div className="bd-skeleton h-6 w-1/2" />
          <div className="bd-skeleton h-10 w-full" />
        </div>

      ) : fetchError ? (
        <div className="flex items-center gap-2 p-3 rounded-xl text-sm" style={{ background: 'rgba(245,197,66,0.08)', color: 'var(--bd-accent-gold)', border: '1px solid rgba(245,197,66,0.2)' }}>
          <AlertTriangle size={16} /> {fetchError}
        </div>

      ) : isVerified ? (
        /* ── Verified profile view ── */
        <div className="space-y-5">
          {/* Banner */}
          <div className="relative h-36 rounded-xl overflow-hidden" style={{ background: 'rgba(245,197,66,0.06)', border: '1px solid rgba(245,197,66,0.15)' }}>
            {profileData.bannerUrl
              ? <img src={profileData.bannerUrl} className="w-full h-full object-cover" alt="Banner" />
              : <div className="w-full h-full flex items-center justify-center text-xs" style={{ color: 'rgba(245,197,66,0.4)' }}>No Banner Set</div>
            }
            {/* Logo */}
            <div className="absolute -bottom-6 left-5">
              <div className="w-14 h-14 rounded-xl overflow-hidden shadow-lg" style={{ background: '#0a0a0f', border: '2px solid rgba(245,197,66,0.4)' }}>
                {profileData.logoUrl
                  ? <img src={profileData.logoUrl} className="w-full h-full object-cover" alt="Logo" />
                  : <div className="w-full h-full flex items-center justify-center text-base font-black" style={{ color: 'var(--bd-accent-gold)' }}>
                      {formData.appName?.[0]?.toUpperCase() || '?'}
                    </div>
                }
              </div>
            </div>
            {/* Verified badge */}
            <div className="bd-badge-verified absolute top-3 right-3 px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1">
              <CheckCircle size={11} /> Verified
            </div>
          </div>

          {/* Info + Actions */}
          <div className="pt-5 flex flex-col md:flex-row justify-between items-start gap-3">
            <div className="min-w-0">
              <h3 className="text-base font-black text-white truncate">{formData.appName}</h3>
              <a
                href={formData.appUrl} target="_blank" rel="noreferrer"
                className="text-xs flex items-center gap-1 mt-1 hover:underline truncate"
                style={{ color: 'var(--bd-accent-gold)' }}
              >
                <Globe size={11} /> {formData.appUrl}
              </a>
              {formData.description && (
                <p className="text-xs text-slate-400 mt-1 leading-relaxed max-w-sm">{formData.description}</p>
              )}
            </div>
            <div className="flex flex-wrap gap-2 flex-shrink-0">
              <button
                onClick={() => setIsEditing(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={isEditing
                  ? { background: 'rgba(245,197,66,0.1)', color: 'var(--bd-accent-gold)', border: '1px solid rgba(245,197,66,0.3)' }
                  : { background: 'rgba(245,197,66,0.08)', color: 'var(--bd-accent-gold)', border: '1px solid rgba(245,197,66,0.2)' }
                }
              >
                {isEditing ? <><X size={12} /> Cancel</> : <><Edit3 size={12} /> Edit Profile</>}
              </button>

              <button
                onClick={startNewProject}
                disabled={projects.length >= MAX_PROJECTS}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'rgba(192,132,252,0.1)', color: 'var(--bd-accent-purple)', border: '1px solid rgba(192,132,252,0.2)' }}
                title={projects.length >= MAX_PROJECTS ? `Maximum ${MAX_PROJECTS} projects reached` : 'Register another project'}
              >
                <PlusCircle size={12} /> Register New App
              </button>
            </div>
          </div>

          {/* Sample images — view only */}
          {!isEditing && profileData.sampleImages.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: 'rgba(245,197,66,0.5)' }}>
                Sample Screenshots
              </p>
              <div className="bd-img-scroll">
                {profileData.sampleImages.map((url, i) => (
                  <img key={i} src={url} className="h-24 flex-shrink-0 rounded-lg object-cover" style={{ border: '1px solid rgba(245,197,66,0.15)' }} alt={`Sample ${i + 1}`} />
                ))}
              </div>
            </div>
          )}

          {/* Edit form */}
          {isEditing && (
            <div className="space-y-4 p-4 rounded-2xl" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(245,197,66,0.15)' }}>
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: 'var(--bd-accent-gold)' }}>App Name</label>
                <input className="bd-input" type="text" value={formData.appName} onChange={e => setFormData({ ...formData, appName: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: 'var(--bd-accent-gold)' }}>Description</label>
                <textarea className="bd-input" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={3} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1" style={{ color: 'var(--bd-accent-gold)' }}>Category</label>
                  <input className="bd-input" type="text" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} placeholder="DeFi, NFT…" />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1" style={{ color: 'var(--bd-accent-gold)' }}>Contract Address</label>
                  <input className="bd-input" type="text" value={formData.contractAddress} onChange={e => setFormData({ ...formData, contractAddress: e.target.value })} placeholder="0x…" />
                </div>
              </div>

              <hr style={{ borderColor: 'rgba(245,197,66,0.1)' }} />

              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: 'var(--bd-accent-gold)' }}>Logo</label>
                <input type="file" accept="image/*" onChange={e => handleMediaUpload(e, 'logo')} className="block w-full text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:font-bold file:cursor-pointer file:bg-[rgba(245,197,66,0.1)] file:text-[#f5c542]" />
                <input className="bd-input mt-2" type="url" value={profileData.logoUrl} onChange={e => setProfileData({ ...profileData, logoUrl: e.target.value })} placeholder="https://…/logo.png" />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: 'var(--bd-accent-gold)' }}>Banner</label>
                <input type="file" accept="image/*" onChange={e => handleMediaUpload(e, 'banner')} className="block w-full text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:font-bold file:cursor-pointer file:bg-[rgba(245,197,66,0.1)] file:text-[#f5c542]" />
                <input className="bd-input mt-2" type="url" value={profileData.bannerUrl} onChange={e => setProfileData({ ...profileData, bannerUrl: e.target.value })} placeholder="https://…/banner.jpg" />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: 'var(--bd-accent-gold)' }}>
                  Sample Screenshots <span className="opacity-50">(max 5)</span>
                </label>
                <div className="flex gap-2 mb-2">
                  <input type="file" accept="image/*" onChange={e => handleMediaUpload(e, 'sample')} className="block w-full text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:font-bold file:cursor-pointer file:bg-[rgba(245,197,66,0.1)] file:text-[#f5c542]" />
                  <input className="bd-input" type="url" value={newSampleUrl} onChange={e => setNewSampleUrl(e.target.value)} placeholder="or paste URL" />
                  <button onClick={addSampleImageUrl} className="bd-btn-primary px-3 rounded-lg flex-shrink-0 flex items-center gap-1 text-xs">
                    <ImagePlus size={14} />
                  </button>
                </div>
                {profileData.sampleImages.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {profileData.sampleImages.map((url, i) => (
                      <div key={i} className="relative group">
                        <img src={url} className="h-16 w-24 rounded-lg object-cover" style={{ border: '1px solid rgba(245,197,66,0.15)' }} alt="" />
                        <button
                          onClick={() => removeSampleImage(i)}
                          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[8px] opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ background: '#f5c542', color: '#0a0a0f' }}
                        >✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button onClick={handleSaveProfile} disabled={isSaving || isUploadingMedia} className="bd-btn-primary w-full py-3 rounded-xl flex justify-center items-center gap-2 text-sm">
                {isSaving || isUploadingMedia
                  ? <><Loader2 className="animate-spin w-4 h-4" /> {isUploadingMedia ? 'Uploading…' : 'Saving…'}</>
                  : <><Save size={15} /> Save Profile</>
                }
              </button>
            </div>
          )}
        </div>

      ) : !verificationHash ? (
        /* ── Registration form ── */
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-xs font-bold mb-1" style={{ color: 'var(--bd-accent-gold)' }}>App Name</label>
            <input required className="bd-input" type="text" value={formData.appName} onChange={e => setFormData({ ...formData, appName: e.target.value })} />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1" style={{ color: 'var(--bd-accent-gold)' }}>Website URL</label>
            <input required className="bd-input" type="url" value={formData.appUrl} onChange={e => setFormData({ ...formData, appUrl: e.target.value })} placeholder="https://myapp.com" />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1" style={{ color: 'var(--bd-accent-gold)' }}>Description</label>
            <textarea className="bd-input" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={3} />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1" style={{ color: 'var(--bd-accent-gold)' }}>
              Arc Chain Contract Address <span className="opacity-50">(optional)</span>
            </label>
            <input className="bd-input" type="text" value={formData.contractAddress} onChange={e => setFormData({ ...formData, contractAddress: e.target.value })} placeholder="0x…" />
          </div>
          <button disabled={isRegistering} type="submit" className="bd-btn-primary w-full py-2.5 rounded-xl flex justify-center items-center gap-2 text-sm">
            {isRegistering ? <Loader2 className="animate-spin w-4 h-4" /> : 'Generate Metadata Tag'}
          </button>
        </form>

      ) : (
        /* ── Verification steps ── */
        <div className="space-y-5">
          <div className="p-4 rounded-xl space-y-2" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(245,197,66,0.15)' }}>
            <h3 className="text-sm font-bold" style={{ color: 'var(--bd-accent-gold)' }}>
              Step 1: Add this meta tag to your &lt;head&gt;
            </h3>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-2 rounded text-xs overflow-x-auto" style={{ background: '#000', color: 'var(--bd-accent-gold)' }}>
                {`<meta name="arcomni-verification" content="${verificationHash}">`}
              </code>
              <button onClick={copyToClipboard} className="p-2 rounded-lg flex-shrink-0" style={{ background: 'rgba(245,197,66,0.1)', color: 'var(--bd-accent-gold)', border: '1px solid rgba(245,197,66,0.2)' }}>
                <Copy size={15} />
              </button>
            </div>
          </div>

          <div className="p-4 rounded-xl space-y-2" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(245,197,66,0.15)' }}>
            <h3 className="text-sm font-bold" style={{ color: 'var(--bd-accent-gold)' }}>Step 2: Verify Configuration</h3>
            <button
              onClick={handleVerify}
              disabled={isVerifying || isVerified}
              className={`w-full py-2.5 rounded-xl font-bold flex justify-center items-center gap-2 text-sm transition-all ${isVerified ? '' : 'bd-btn-primary'}`}
              style={isVerified ? { background: 'rgba(245,197,66,0.15)', color: 'var(--bd-accent-gold)', border: '1px solid rgba(245,197,66,0.4)' } : {}}
            >
              {isVerifying
                ? <Loader2 className="animate-spin w-4 h-4" />
                : isVerified
                  ? <><CheckCircle size={16} /> Verified</>
                  : 'Verify Now'
              }
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
