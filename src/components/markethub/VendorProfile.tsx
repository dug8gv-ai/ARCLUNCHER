'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAccount } from 'wagmi';
import { Loader2, Image as ImageIcon, Save, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

export function VendorProfile() {
  const { address } = useAccount();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profileExists, setProfileExists] = useState(false);

  const [storeName, setStoreName] = useState('');
  const [description, setDescription] = useState('');
  const [roles, setRoles] = useState('');
  const [phone, setPhone] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [logoUrl, setLogoUrl] = useState('');

  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);

  useEffect(() => {
    if (address) {
      fetchProfile();
    }
  }, [address]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('vendor_profiles')
        .select('*')
        .eq('wallet', address?.toLowerCase())
        .single();

      if (data) {
        setProfileExists(true);
        setStoreName(data.store_name || '');
        setDescription(data.description || '');
        setRoles(data.roles || '');
        setPhone(data.phone || '');
        setBannerUrl(data.banner_url || '');
        setLogoUrl(data.logo_url || '');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const uploadFile = async (file: File, path: string) => {
    const { data, error } = await supabase.storage
      .from('market_images')
      .upload(path, file, { upsert: true });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from('market_images')
      .getPublicUrl(path);

    return publicUrl;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return toast.error('Connect wallet first');
    if (!storeName) return toast.error('Store Name is required');

    setSaving(true);
    const toastId = toast.loading('Saving vendor profile...');

    try {
      let finalBannerUrl = bannerUrl;
      let finalLogoUrl = logoUrl;

      // Upload Banner
      if (bannerFile) {
        toast.loading('Uploading banner...', { id: toastId });
        finalBannerUrl = await uploadFile(bannerFile, `${address.toLowerCase()}/banner-${Date.now()}`);
      }

      // Upload Logo
      if (logoFile) {
        toast.loading('Uploading logo...', { id: toastId });
        finalLogoUrl = await uploadFile(logoFile, `${address.toLowerCase()}/logo-${Date.now()}`);
      }

      toast.loading('Updating database...', { id: toastId });
      
      const profileData = {
        wallet: address.toLowerCase(),
        store_name: storeName,
        description,
        roles,
        phone,
        banner_url: finalBannerUrl,
        logo_url: finalLogoUrl,
      };

      const { error } = await supabase
        .from('vendor_profiles')
        .upsert(profileData);

      if (error) throw error;

      setProfileExists(true);
      toast.success('Vendor profile saved successfully!', { id: toastId });
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Failed to save profile', { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  if (!address) {
    return (
      <div className="stat-box rounded-[32px] p-8 text-center text-[var(--text-secondary)]">
        Please connect your wallet to set up a Vendor Profile.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin text-[var(--accent-cyan)] size-8" />
      </div>
    );
  }

  return (
    <div className="stat-box rounded-[32px] p-6 sm:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-[var(--text-primary)]">Vendor Storefront Setup</h2>
          <p className="text-xs text-[var(--text-secondary)] font-semibold mt-1">Manage your ArcOmni Marketplace presence</p>
        </div>
        {profileExists && (
          <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-wider rounded-full border border-emerald-500/20">
            <CheckCircle2 size={12} /> Active Store
          </span>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Store Information */}
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-extrabold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">Store Name *</label>
              <input
                type="text"
                value={storeName}
                onChange={e => setStoreName(e.target.value)}
                placeholder="e.g. Arc Digital Electronics"
                className="w-full cyber-input px-4 py-3 rounded-xl text-sm outline-none transition-all focus:border-[var(--accent-cyan)] focus:ring-2 focus:ring-[rgba(0,242,254,0.1)] text-[var(--text-primary)]"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="What does your store sell?"
                rows={3}
                className="w-full cyber-input px-4 py-3 rounded-xl text-sm outline-none transition-all focus:border-[var(--accent-cyan)] focus:ring-2 focus:ring-[rgba(0,242,254,0.1)] text-[var(--text-primary)]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-extrabold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">Store Roles / Tags</label>
                <input
                  type="text"
                  value={roles}
                  onChange={e => setRoles(e.target.value)}
                  placeholder="e.g. Electronics, Gadgets"
                  className="w-full cyber-input px-4 py-3 rounded-xl text-sm outline-none transition-all focus:border-[var(--accent-cyan)] focus:ring-2 focus:ring-[rgba(0,242,254,0.1)] text-[var(--text-primary)]"
                />
              </div>
              <div>
                <label className="block text-[10px] font-extrabold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">WhatsApp / Phone</label>
                <input
                  type="text"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+1 234 567 8900"
                  className="w-full cyber-input px-4 py-3 rounded-xl text-sm outline-none transition-all focus:border-[var(--accent-cyan)] focus:ring-2 focus:ring-[rgba(0,242,254,0.1)] text-[var(--text-primary)]"
                />
              </div>
            </div>
          </div>

          {/* Media Uploads */}
          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-extrabold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">Store Logo</label>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl overflow-hidden bg-[var(--bg-elevated)] border border-[var(--border-dim)] flex items-center justify-center">
                  {logoFile ? (
                    <img src={URL.createObjectURL(logoFile)} alt="Preview" className="w-full h-full object-cover" />
                  ) : logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon className="text-[var(--text-secondary)]" size={24} />
                  )}
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={e => e.target.files && setLogoFile(e.target.files[0])}
                  className="text-xs text-[var(--text-secondary)] file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-[rgba(0,242,254,0.1)] file:text-[var(--accent-cyan)] hover:file:bg-[rgba(0,242,254,0.2)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-extrabold text-[var(--text-secondary)] uppercase tracking-wider mb-1.5">Store Banner</label>
              <div className="w-full h-32 rounded-xl overflow-hidden bg-[var(--bg-elevated)] border border-[var(--border-dim)] flex items-center justify-center relative group">
                {bannerFile ? (
                  <img src={URL.createObjectURL(bannerFile)} alt="Preview" className="w-full h-full object-cover opacity-80" />
                ) : bannerUrl ? (
                  <img src={bannerUrl} alt="Banner" className="w-full h-full object-cover opacity-80" />
                ) : (
                  <ImageIcon className="text-[var(--text-secondary)]" size={32} />
                )}
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={e => e.target.files && setBannerFile(e.target.files[0])}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <span className="text-white text-xs font-bold px-3 py-1.5 bg-black/50 rounded-lg backdrop-blur-md">Upload Banner Image</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-[var(--border-dim)] flex justify-end">
          <button
            type="submit"
            disabled={saving || !storeName}
            className="deploy-btn px-8 py-3.5 rounded-xl font-bold flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            {saving ? 'Saving Profile...' : 'Save Vendor Profile'}
          </button>
        </div>
      </form>
    </div>
  );
}
