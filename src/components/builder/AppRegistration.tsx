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
  created_at?: string;
}

const MAX_PROJECTS = 10;

// ── localStorage ──────────────────────────────────────────────────────────────
function lsKey(addr: string) { return `arcomni_v4_${addr.toLowerCase()}`; }
function lsSave(addr: string, data: RegisteredApp[]) {
  try { localStorage.setItem(lsKey(addr), JSON.stringify(data)); } catch { /**/ }
}
function lsLoad(addr: string): RegisteredApp[] | null {
  try { const r = localStorage.getItem(lsKey(addr)); return r ? JSON.parse(r) : null; } catch { return null; }
}

// ── Convert DB row → form state ───────────────────────────────────────────────
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

// ── Deduplicate: keep verified rows, then newest per app_url ──────────────────
function dedupe(list: RegisteredApp[]): RegisteredApp[] {
  const seen = new Map<string, RegisteredApp>();
  // Process verified first so they win
  const sorted = [...list].sort((a, b) => {
    if (a.is_verified && !b.is_verified) return -1;
    if (!a.is_verified && b.is_verified) return 1;
    return new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime();
  });
  for (const row of sorted) {
    const key = (row.app_url ?? '').toLowerCase();
    if (!seen.has(key)) seen.set(key, row);
  }
  return [...seen.values()];
}

export function AppRegistration() {
  const { address, isConnected } = useAccount();

  const [projects,      setProjects]      = useState<RegisteredApp[]>([]);
  const [activeId,      setActiveId]      = useState<string | null>(null);
  const [form,          setForm]          = useState(EMPTY_FORM);
  const [isLoading,     setIsLoading]     = useState(true);
  const [fetchError,    setFetchError]    = useState('');
  const [selectorOpen,  setSelectorOpen]  = useState(false);
  const [isEditing,     setIsEditing]     = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isVerifying,   setIsVerifying]   = useState(false);
  const [isSaving,      setIsSaving]      = useState(false);
  const [isUploading,   setIsUploading]   = useState(false);
  const [newSampleUrl,  setNewSampleUrl]  = useState('');
  // Controls whether the registration form is shown (for new project)
  const [showRegForm,   setShowRegForm]   = useState(false);

  // ── Load projects ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!address) {
      setIsLoading(false); setProjects([]); setActiveId(null);
      setForm(EMPTY_FORM); setShowRegForm(false); return;
    }

    // Show cache immediately
    const cached = lsLoad(address);
    if (cached && cached.length > 0) {
      const deduped = dedupe(cached);
      setProjects(deduped);
      pickBestProject(deduped, null);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }

    let cancelled = false;
    (async () => {
      try {
        // 10-second timeout guard: on timeout, show blank form without reading localStorage
        const fetchPromise = supabase
          .from('registered_apps')
          .select('*')
          .eq('developer_wallet', address)
          .order('created_at', { ascending: true });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('timeout')), 10_000)
        );

        const result = await Promise.race([fetchPromise, timeoutPromise]);
        const { data, error } = result as Awaited<typeof fetchPromise>;

        if (cancelled) return;

        if (error) {
          // HTTP error from Supabase — show blank form, do NOT read localStorage
          setProjects([]);
          setActiveId(null);
          setForm(EMPTY_FORM);
          setShowRegForm(false);
          setFetchError('Could not load projects. Please refresh.');
          return;
        }

        const raw   = (data ?? []) as RegisteredApp[];
        // Merge cached fields for fields that RLS might hide
        const prev  = lsLoad(address) ?? [];
        const merged = raw.map(fresh => {
          const old = prev.find(c => c.id === fresh.id);
          return {
            ...fresh,
            is_verified:   fresh.is_verified  || old?.is_verified   || false,
            logo_url:      fresh.logo_url     || old?.logo_url      || '',
            banner_url:    fresh.banner_url   || old?.banner_url    || '',
            sample_images: (fresh.sample_images?.length ? fresh.sample_images : old?.sample_images) ?? [],
          };
        });
        const deduped = dedupe(merged);

        // Supabase is authoritative — overwrite any conflicting localStorage values
        setProjects(deduped);
        lsSave(address, deduped);
        pickBestProject(deduped, null);
      } catch (err: unknown) {
        if (cancelled) return;
        // Timeout or unexpected error — show blank form, do NOT read localStorage
        if ((err as Error)?.message === 'timeout') {
          setProjects([]);
          setActiveId(null);
          setForm(EMPTY_FORM);
          setShowRegForm(false);
        } else {
          setFetchError('Could not load projects. Please refresh.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  // Pick the best project to display: verified first, then most recent
  function pickBestProject(list: RegisteredApp[], preferId: string | null) {
    if (list.length === 0) { setActiveId(null); setForm(EMPTY_FORM); setShowRegForm(false); return; }
    const preferred = preferId ? list.find(p => p.id === preferId) : null;
    const verified  = list.find(p => p.is_verified);
    const target    = preferred ?? verified ?? list[0];
    setActiveId(target.id);
    setForm(toForm(target));
    setShowRegForm(false);
    setIsEditing(false);
  }

  // ── Switch project from dropdown ────────────────────────────────────────────
  const switchProject = (id: string) => {
    const p = projects.find(x => x.id === id);
    if (!p) return;
    setActiveId(id);
    setForm(toForm(p));
    setIsEditing(false);
    setShowRegForm(false);
    setSelectorOpen(false);
  };

  // ── Start new registration ──────────────────────────────────────────────────
  const startNewProject = () => {
    setActiveId(null);
    setForm(EMPTY_FORM);
    setIsEditing(false);
    setShowRegForm(true);
    setSelectorOpen(false);
  };

  // ── Cancel new registration ─────────────────────────────────────────────────
  const cancelNewProject = () => {
    setShowRegForm(false);
    pickBestProject(projects, activeId);
  };

  // ── Register new app ────────────────────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected || !address) { toast.error('Connect wallet first'); return; }
    if (projects.length >= MAX_PROJECTS) { toast.error(`Max ${MAX_PROJECTS} projects`); return; }
    setIsRegistering(true);
    try {
      const hash = `arcomni-${Math.random().toString(36).slice(2, 15)}-${Date.now()}`;
      const { data, error } = await supabase
        .from('registered_apps')
        .insert({
          developer_wallet:  address,
          app_name:          form.appName,
          app_url:           form.appUrl,
          description:       form.description,
          category:          form.category,
          team_size:         parseInt(form.teamSize) || 1,
          contract_address:  form.contractAddress,
          verification_hash: hash,
          is_verified:       false,
        })
        .select().single();
      if (error) throw error;
      const newApp  = data as RegisteredApp;
      const updated = dedupe([...projects, newApp]);
      setProjects(updated);
      lsSave(address, updated);
      setActiveId(newApp.id);
      setForm(toForm(newApp));
      setShowRegForm(false); // switch to verification screen for this new app
      toast.success('Saved! Complete verification below.');
    } catch (err: unknown) {
      toast.error((err as { message?: string }).message ?? 'Failed to register');
    } finally { setIsRegistering(false); }
  };

  // ── Verify ──────────────────────────────────────────────────────────────────
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
        const updated = projects.map(p => p.id === activeId ? { ...p, is_verified: true } : p);
        setProjects(updated);
        lsSave(address, updated);
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

  // ── Save profile edits ──────────────────────────────────────────────────────
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
      const e = err as { message?: string; details?: string };
      toast.error(e.details ?? e.message ?? 'Save failed');
    } finally { setIsSaving(false); }
  };

  // ── Media upload ────────────────────────────────────────────────────────────
  const uploadFile = async (file: File, path: string) => {
    const { error } = await supabase.storage.from('market_images').upload(path, file, { upsert: true });
    if (error) throw error;
    return supabase.storage.from('market_images').getPublicUrl(path).data.publicUrl;
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'banner' | 'sample') => {
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
      toast.error((err as { message?: string }).message ?? 'Upload failed');
    } finally { setIsUploading(false); e.target.value = ''; }
  };

  const addSampleUrl = () => {
    if (!newSampleUrl.trim() || form.sampleImages.length >= 5) return;
    setForm(p => ({ ...p, sampleImages: [...p.sampleImages, newSampleUrl.trim()] }));
    setNewSampleUrl('');
  };
  const removeSample = (i: number) => setForm(p => ({
    ...p, sampleImages: p.sampleImages.filter((_, j) => j !== i),
  }));
  const copyHash = () => {
    navigator.clipboard.writeText(`<meta name="arcomni-verification" content="${form.verificationHash}">`);
    toast.success('Copied!');
  };

  const activeProject = projects.find(p => p.id === activeId) ?? null;

  // ── Derived display state ───────────────────────────────────────────────────
  // True count of unique projects from DB
  const projectCount = projects.length;
  // Whether "Edit Application" button should be active
  const canEdit = !!activeProject;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="bd-card p-6 w-full max-w-full">

      {/* ══ HEADER: title + live count + action buttons ══ */}
      <div className="mb-5">
        {/* Row 1: Title + count badge */}
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h2 className="text-lg font-black" style={{ color: 'var(--bd-accent-gold)' }}>
            Register New Arc Chain App
          </h2>
          {/* Live count — only shown when wallet is connected */}
          {address && !isLoading && (
            <span
              className="text-xs font-bold px-3 py-1 rounded-full"
              style={{
                background: 'rgba(245,197,66,0.12)',
                color:      'var(--bd-accent-gold)',
                border:     '1px solid rgba(245,197,66,0.3)',
              }}
            >
              {projectCount} / {MAX_PROJECTS} project{projectCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Row 2: Action buttons — always visible when wallet connected */}
        {address && !isLoading && (
          <div className="flex flex-wrap gap-2">
            {/* ➕ Register New App */}
            <button
              onClick={showRegForm ? cancelNewProject : startNewProject}
              disabled={!showRegForm && projectCount >= MAX_PROJECTS}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: showRegForm
                  ? 'rgba(248,113,113,0.1)'
                  : 'rgba(245,197,66,0.1)',
                color: showRegForm ? '#f87171' : 'var(--bd-accent-gold)',
                border: showRegForm
                  ? '1px solid rgba(248,113,113,0.3)'
                  : '1px solid rgba(245,197,66,0.25)',
              }}
              title={projectCount >= MAX_PROJECTS && !showRegForm ? `Max ${MAX_PROJECTS} projects reached` : ''}
            >
              {showRegForm
                ? <><X size={12} /> Cancel Registration</>
                : <><PlusCircle size={12} /> Register New App</>
              }
            </button>

            {/* ✏️ Edit Application — only active when a project is selected */}
            {canEdit && !showRegForm && (
              <button
                onClick={() => setIsEditing(v => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
                style={isEditing
                  ? { background: 'rgba(245,197,66,0.15)', color: 'var(--bd-accent-gold)', border: '1px solid rgba(245,197,66,0.4)' }
                  : { background: 'rgba(192,132,252,0.1)',  color: 'var(--bd-accent-purple)', border: '1px solid rgba(192,132,252,0.25)' }
                }
              >
                {isEditing
                  ? <><X size={12} /> Cancel Edit</>
                  : <><Edit3 size={12} /> Edit Application</>
                }
              </button>
            )}
          </div>
        )}
      </div>

      {/* ══ PROJECT SELECTOR — only when 2+ unique projects ══ */}
      {projects.length >= 2 && !showRegForm && (
        <div className="mb-4 relative">
          <button
            onClick={() => setSelectorOpen(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-sm font-bold"
            style={{ background: 'rgba(248,250,252,0.95)', border: '1px solid rgba(203,213,225,0.7)', color: '#1e293b' }}
          >
            <span className="truncate">{activeProject?.app_name ?? 'Select project…'}</span>
            <ChevronDown size={14} className="flex-shrink-0 ml-2" style={{ color: 'var(--bd-accent-gold)' }} />
          </button>
          {selectorOpen && (
            <div
              className="absolute z-20 left-0 right-0 mt-1 rounded-xl overflow-hidden shadow-2xl"
              style={{ background: '#f8fafc', border: '1px solid rgba(203,213,225,0.7)' }}
            >
              {projects.map(p => (
                <button
                  key={p.id}
                  onClick={() => switchProject(p.id)}
                  className="w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 hover:bg-white/5"
                  style={{ color: p.id === activeId ? 'var(--bd-accent-gold)' : '#1e293b' }}
                >
                  {p.is_verified && <CheckCircle size={12} style={{ color: 'var(--bd-accent-gold)' }} />}
                  <span className="truncate">{p.app_name}</span>
                  {!p.is_verified && (
                    <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded"
                      style={{ background: 'rgba(245,197,66,0.08)', color: 'rgba(245,197,66,0.5)' }}>
                      unverified
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ══ LOADING SKELETON ══ */}
      {isLoading ? (
        <div className="space-y-3 py-4">
          <div className="bd-skeleton h-32 w-full" />
          <div className="bd-skeleton h-6 w-2/3" />
          <div className="bd-skeleton h-6 w-1/2" />
          <div className="bd-skeleton h-10 w-full" />
        </div>

      ) : fetchError ? (
        <div className="flex items-center gap-2 p-3 rounded-xl text-sm"
          style={{ background: 'rgba(245,197,66,0.08)', color: 'var(--bd-accent-gold)', border: '1px solid rgba(245,197,66,0.2)' }}>
          <AlertTriangle size={16} /> {fetchError}
        </div>

      ) : showRegForm ? (
        /* ════ NEW REGISTRATION FORM ════
           Verification steps (Step 1 & Step 2) are HIDDEN here.
           They only appear after successful submit. */
        <form onSubmit={handleRegister} className="space-y-4 animate-in fade-in duration-200">
          <div>
            <label className="block text-xs font-bold mb-1" style={{ color: 'var(--bd-accent-gold)' }}>App Name</label>
            <input required className="bd-input" type="text" value={form.appName}
              onChange={e => setForm(p => ({ ...p, appName: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1" style={{ color: 'var(--bd-accent-gold)' }}>Website URL</label>
            <input required className="bd-input" type="url" value={form.appUrl} placeholder="https://myapp.com"
              onChange={e => setForm(p => ({ ...p, appUrl: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1" style={{ color: 'var(--bd-accent-gold)' }}>Description</label>
            <textarea className="bd-input" value={form.description} rows={3}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div>
            <label className="block text-xs font-bold mb-1" style={{ color: 'var(--bd-accent-gold)' }}>
              Contract Address <span className="opacity-50">(optional)</span>
            </label>
            <input className="bd-input" type="text" value={form.contractAddress} placeholder="0x…"
              onChange={e => setForm(p => ({ ...p, contractAddress: e.target.value }))} />
          </div>
          <button
            disabled={isRegistering} type="submit"
            className="bd-btn-primary w-full py-2.5 rounded-xl flex justify-center items-center gap-2 text-sm"
          >
            {isRegistering ? <Loader2 className="animate-spin w-4 h-4" /> : 'Generate Metadata Tag'}
          </button>
        </form>

      ) : form.isVerified ? (
        /* ════ VERIFIED PROFILE VIEW ════ */
        <div className="space-y-5 animate-in fade-in duration-200">
          {/* Banner + Logo */}
          <div className="relative h-36 rounded-xl overflow-hidden"
            style={{ background: 'rgba(245,197,66,0.06)', border: '1px solid rgba(245,197,66,0.15)' }}>
            {form.bannerUrl
              ? <img src={form.bannerUrl} className="w-full h-full object-cover" alt="Banner" />
              : <div className="w-full h-full flex items-center justify-center text-xs" style={{ color: 'rgba(245,197,66,0.4)' }}>No Banner Set</div>
            }
            <div className="absolute -bottom-6 left-5">
              <div className="w-14 h-14 rounded-xl overflow-hidden shadow-lg"
                style={{ background: '#f8fafc', border: '2px solid rgba(245,197,66,0.4)' }}>
                {form.logoUrl
                  ? <img src={form.logoUrl} className="w-full h-full object-cover" alt="Logo" />
                  : <div className="w-full h-full flex items-center justify-center text-base font-black" style={{ color: 'var(--bd-accent-gold)' }}>
                      {form.appName?.[0]?.toUpperCase() || '?'}
                    </div>
                }
              </div>
            </div>
            <div className="bd-badge-verified absolute top-3 right-3 px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1">
              <CheckCircle size={11} /> Verified
            </div>
          </div>

          {/* App info — responsive: stacked on mobile, row on md+ */}
          <div className="flex flex-col md:flex-row gap-3 items-start md:items-center pt-5">
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-black text-white truncate">{form.appName}</h3>
              <a
                href={form.appUrl} target="_blank" rel="noreferrer"
                className="text-xs flex items-center gap-1 mt-1 hover:underline truncate"
                style={{ color: 'var(--bd-accent-gold)' }}
              >
                <Globe size={11} /> {form.appUrl}
              </a>
              {form.description && (
                <p className="text-xs text-slate-400 mt-1 leading-relaxed max-w-sm">{form.description}</p>
              )}
            </div>
          </div>

          {/* Screenshots (view-only) */}
          {!isEditing && form.sampleImages.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: '#94a3b8' }}>
                Sample Screenshots
              </p>
              <div className="bd-img-scroll">
                {form.sampleImages.map((url, i) => (
                  <img key={i} src={url} className="h-24 flex-shrink-0 rounded-lg object-cover"
                    style={{ border: '1px solid rgba(245,197,66,0.15)' }} alt={`S${i + 1}`} />
                ))}
              </div>
            </div>
          )}

          {/* Edit form — shown when isEditing toggled from header button */}
          {isEditing && (
            <div className="space-y-4 p-4 rounded-2xl animate-in fade-in duration-150"
              style={{ background: 'rgba(248,250,252,0.95)', border: '1px solid rgba(245,197,66,0.15)' }}>
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: 'var(--bd-accent-gold)' }}>App Name</label>
                <input className="bd-input" type="text" value={form.appName}
                  onChange={e => setForm(p => ({ ...p, appName: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: 'var(--bd-accent-gold)' }}>Description</label>
                <textarea className="bd-input" value={form.description} rows={3}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold mb-1" style={{ color: 'var(--bd-accent-gold)' }}>Category</label>
                  <input className="bd-input" type="text" value={form.category} placeholder="DeFi, NFT…"
                    onChange={e => setForm(p => ({ ...p, category: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs font-bold mb-1" style={{ color: 'var(--bd-accent-gold)' }}>Contract Address</label>
                  <input className="bd-input" type="text" value={form.contractAddress} placeholder="0x…"
                    onChange={e => setForm(p => ({ ...p, contractAddress: e.target.value }))} />
                </div>
              </div>
              <hr style={{ borderColor: 'rgba(245,197,66,0.1)' }} />
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: 'var(--bd-accent-gold)' }}>Logo</label>
                <input type="file" accept="image/*" onChange={e => handleMediaUpload(e, 'logo')}
                  className="block w-full text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:font-bold file:cursor-pointer file:bg-[rgba(245,197,66,0.1)] file:text-[#f5c542]" />
                <input className="bd-input mt-2" type="url" value={form.logoUrl} placeholder="https://…/logo.png"
                  onChange={e => setForm(p => ({ ...p, logoUrl: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: 'var(--bd-accent-gold)' }}>Banner</label>
                <input type="file" accept="image/*" onChange={e => handleMediaUpload(e, 'banner')}
                  className="block w-full text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:font-bold file:cursor-pointer file:bg-[rgba(245,197,66,0.1)] file:text-[#f5c542]" />
                <input className="bd-input mt-2" type="url" value={form.bannerUrl} placeholder="https://…/banner.jpg"
                  onChange={e => setForm(p => ({ ...p, bannerUrl: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1" style={{ color: 'var(--bd-accent-gold)' }}>
                  Sample Screenshots <span className="opacity-50">(max 5)</span>
                </label>
                <div className="flex gap-2 mb-2">
                  <input type="file" accept="image/*" onChange={e => handleMediaUpload(e, 'sample')}
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
                          style={{ border: '1px solid rgba(245,197,66,0.15)' }} alt="" />
                        <button onClick={() => removeSample(i)}
                          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-[8px] opacity-0 group-hover:opacity-100 transition-opacity"
                          style={{ background: '#f5c542', color: '#1e293b' }}>✕</button>
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

      ) : form.verificationHash ? (
        /* ════ VERIFICATION SCREEN
           ONLY shown when: hash exists AND is_verified=false AND NOT in showRegForm
           Step 1 & Step 2 visible here because user just registered and needs to verify ════ */
        <div className="space-y-5 animate-in fade-in duration-200">
          <div className="p-4 rounded-xl space-y-2"
            style={{ background: 'rgba(248,250,252,0.95)', border: '1px solid rgba(245,197,66,0.15)' }}>
            <h3 className="text-sm font-bold" style={{ color: 'var(--bd-accent-gold)' }}>
              Step 1: Add this meta tag to your &lt;head&gt;
            </h3>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-2 rounded text-xs overflow-x-auto"
                style={{ background: '#000', color: 'var(--bd-accent-gold)' }}>
                {`<meta name="arcomni-verification" content="${form.verificationHash}">`}
              </code>
              <button onClick={copyHash} className="p-2 rounded-lg flex-shrink-0"
                style={{ background: 'rgba(245,197,66,0.1)', color: 'var(--bd-accent-gold)', border: '1px solid rgba(245,197,66,0.2)' }}>
                <Copy size={15} />
              </button>
            </div>
          </div>
          <div className="p-4 rounded-xl space-y-2"
            style={{ background: 'rgba(248,250,252,0.95)', border: '1px solid rgba(245,197,66,0.15)' }}>
            <h3 className="text-sm font-bold" style={{ color: 'var(--bd-accent-gold)' }}>Step 2: Verify Configuration</h3>
            <button onClick={handleVerify} disabled={isVerifying}
              className="bd-btn-primary w-full py-2.5 rounded-xl flex justify-center items-center gap-2 text-sm">
              {isVerifying ? <Loader2 className="animate-spin w-4 h-4" /> : 'Verify Now'}
            </button>
          </div>
        </div>

      ) : (
        /* ════ EMPTY STATE: no projects yet, show registration prompt ════ */
        <div className="text-center py-8 space-y-3">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center mx-auto"
            style={{ background: 'rgba(245,197,66,0.08)', border: '1px solid rgba(245,197,66,0.2)' }}>
            <PlusCircle size={22} style={{ color: 'var(--bd-accent-gold)' }} />
          </div>
          <p className="text-sm font-bold" style={{ color: 'var(--bd-accent-gold)' }}>No projects yet</p>
          <p className="text-xs" style={{ color: '#64748b' }}>
            Click "Register New App" above to get started.
          </p>
        </div>
      )}
    </div>
  );
}
