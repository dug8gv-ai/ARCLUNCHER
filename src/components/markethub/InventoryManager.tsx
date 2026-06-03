'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAccount } from 'wagmi';
import { Loader2, Plus, Box, Image as ImageIcon, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export function InventoryManager() {
  const { address } = useAccount();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('Electronics');
  const [price, setPrice] = useState('');
  const [shippingFee, setShippingFee] = useState('');
  const [quantity, setQuantity] = useState('');
  const [imageFiles, setImageFiles] = useState<File[]>([]);

  useEffect(() => {
    if (address) fetchProducts();
  }, [address]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('market_products')
        .select('*')
        .eq('vendor_wallet', address?.toLowerCase())
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const uploadImages = async () => {
    if (!address || imageFiles.length === 0) return [];
    const urls: string[] = [];
    
    for (const file of imageFiles) {
      const path = `${address.toLowerCase()}/products/${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from('market_images').upload(path, file);
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('market_images').getPublicUrl(path);
        urls.push(publicUrl);
      }
    }
    return urls;
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return toast.error('Connect wallet first');
    if (!name || !price || !quantity) return toast.error('Fill required fields');

    setSaving(true);
    const tid = toast.loading('Uploading product...');

    try {
      // First ensure vendor profile exists
      const { data: vProfile } = await supabase.from('vendor_profiles').select('wallet').eq('wallet', address.toLowerCase()).single();
      if (!vProfile) {
        throw new Error('Please setup your Vendor Profile first before adding products.');
      }

      let uploadedUrls: string[] = [];
      if (imageFiles.length > 0) {
        toast.loading('Uploading images...', { id: tid });
        uploadedUrls = await uploadImages();
      }

      toast.loading('Saving listing...', { id: tid });

      const { error } = await supabase.from('market_products').insert({
        vendor_wallet: address.toLowerCase(),
        name,
        description,
        category,
        price: Number(price),
        shipping_fee: Number(shippingFee || 0),
        quantity: Number(quantity),
        images: uploadedUrls
      });

      if (error) throw error;

      toast.success('Product listed successfully!', { id: tid });
      setIsAdding(false);
      resetForm();
      fetchProducts();
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to list product', { id: tid });
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setName('');
    setDescription('');
    setCategory('Electronics');
    setPrice('');
    setShippingFee('');
    setQuantity('');
    setImageFiles([]);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      const { error } = await supabase.from('market_products').delete().eq('id', id);
      if (error) throw error;
      toast.success('Product deleted');
      setProducts(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      console.error(err);
      toast.error('Failed to delete product');
    }
  };

  if (!address) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-[var(--text-primary)]">Inventory & Stock</h2>
          <p className="text-xs text-[var(--text-secondary)] font-semibold mt-1">Manage your storefront listings</p>
        </div>
        {!isAdding && (
          <button
            onClick={() => setIsAdding(true)}
            className="deploy-btn px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5"
          >
            <Plus size={14} /> Add New Product
          </button>
        )}
      </div>

      {isAdding && (
        <div className="stat-box rounded-[32px] p-6 sm:p-8 animate-in fade-in slide-in-from-top-4">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-black text-[var(--accent-cyan)]">Create New Listing</h3>
            <button onClick={() => setIsAdding(false)} className="text-[var(--text-secondary)] hover:text-white transition-colors">
              Cancel
            </button>
          </div>
          
          <form onSubmit={handleAddProduct} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-extrabold text-[var(--text-secondary)] uppercase mb-1.5">Product Name *</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full cyber-input px-4 py-3 rounded-xl text-sm" placeholder="e.g. Arc Phone Pro" />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-[var(--text-secondary)] uppercase mb-1.5">Description</label>
                  <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} className="w-full cyber-input px-4 py-3 rounded-xl text-sm" placeholder="Detailed product specs..." />
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-[var(--text-secondary)] uppercase mb-1.5">Category</label>
                  <select value={category} onChange={e => setCategory(e.target.value)} className="w-full cyber-input px-4 py-3 rounded-xl text-sm">
                    <option value="Electronics">Electronics</option>
                    <option value="Digital Goods">Digital Goods</option>
                    <option value="Merchandise">Merchandise</option>
                    <option value="Services">Services</option>
                  </select>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-extrabold text-[var(--text-secondary)] uppercase mb-1.5">Price (USDC) *</label>
                    <input type="number" step="0.01" value={price} onChange={e => setPrice(e.target.value)} required className="w-full cyber-input px-4 py-3 rounded-xl text-sm" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-extrabold text-[var(--text-secondary)] uppercase mb-1.5">Total Quantity/Stock *</label>
                    <input type="number" step="1" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} required className="w-full cyber-input px-4 py-3 rounded-xl text-sm" placeholder="e.g. 5" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-[var(--text-secondary)] uppercase mb-1.5">Shipping Fee (USDC)</label>
                  <input type="number" step="0.01" value={shippingFee} onChange={e => setShippingFee(e.target.value)} className="w-full cyber-input px-4 py-3 rounded-xl text-sm" placeholder="0.00 (Leave empty for Free)" />
                </div>
                
                <div>
                  <label className="block text-[10px] font-extrabold text-[var(--text-secondary)] uppercase mb-1.5">Product Images</label>
                  <div className="w-full p-6 border-2 border-dashed border-[var(--border-dim)] bg-[rgba(6,8,20,0.5)] rounded-xl text-center relative hover:border-[var(--accent-cyan)] transition-colors">
                    <input type="file" multiple accept="image/*" onChange={e => e.target.files && setImageFiles(Array.from(e.target.files))} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                    <ImageIcon className="mx-auto text-[var(--text-secondary)] mb-2" size={24} />
                    <p className="text-xs text-[var(--text-secondary)] font-semibold">{imageFiles.length > 0 ? `${imageFiles.length} files selected` : 'Click or drag images here'}</p>
                  </div>
                  {imageFiles.length > 0 && (
                    <div className="flex gap-2 mt-2 overflow-x-auto pb-2">
                      {imageFiles.map((file, i) => (
                         <img key={i} src={URL.createObjectURL(file)} alt="" className="w-12 h-12 rounded object-cover border border-[var(--border-dim)]" />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className="pt-4 border-t border-[var(--border-dim)] flex justify-end">
              <button type="submit" disabled={saving} className="deploy-btn px-8 py-3 rounded-xl font-bold flex items-center gap-2">
                {saving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                {saving ? 'Publishing...' : 'Publish Listing'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Product List */}
      {!isAdding && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
             <div className="col-span-full flex justify-center py-12"><Loader2 className="animate-spin text-[var(--accent-cyan)] size-8" /></div>
          ) : products.length === 0 ? (
             <div className="col-span-full stat-box rounded-[32px] p-12 text-center">
               <Box className="mx-auto text-slate-500 mb-4" size={48} />
               <h3 className="text-lg font-bold text-[var(--text-primary)] mb-1">No products yet</h3>
               <p className="text-sm text-[var(--text-secondary)] mb-4">Add your first product to start selling globally.</p>
             </div>
          ) : (
            products.map(p => (
              <div key={p.id} className="stat-box rounded-[24px] overflow-hidden flex flex-col">
                <div className="h-40 bg-[rgba(6,8,20,0.8)] border-b border-[var(--border-dim)] relative">
                  {p.images && p.images[0] ? (
                    <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center"><ImageIcon className="text-[var(--text-secondary)]" size={32} /></div>
                  )}
                  <div className="absolute top-3 right-3 bg-black/60 backdrop-blur px-2 py-1 rounded text-[10px] font-black text-white border border-white/10">
                    {p.quantity} In Stock
                  </div>
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-black text-sm text-[var(--text-primary)] truncate pr-2">{p.name}</h4>
                    <span className="text-[var(--accent-cyan)] font-extrabold text-sm">${p.price}</span>
                  </div>
                  <span className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider bg-[rgba(0,242,254,0.05)] self-start px-2 py-0.5 rounded border border-[var(--border-dim)] mb-3">{p.category}</span>
                  <div className="mt-auto pt-4 border-t border-[var(--border-dim)] flex justify-between items-center">
                    <span className="text-[10px] text-slate-400 font-semibold">{new Date(p.created_at).toLocaleDateString()}</span>
                    <button onClick={() => handleDelete(p.id)} className="text-red-400 hover:text-red-300 transition-colors p-1 bg-red-400/10 rounded-md">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
