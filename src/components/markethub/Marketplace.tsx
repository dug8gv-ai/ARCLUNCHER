'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAccount, useSendTransaction, useWriteContract, useChainId } from 'wagmi';
import { parseUnits, parseEther, erc20Abi, isAddress } from 'viem';
import { Loader2, ShoppingCart, ShieldCheck, MapPin, Search, Star, CreditCard, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { ARCSLOTS_TOKENS } from '@/lib/arcslots/arcslots.constants';

// For gamification
const triggerPremiumAlert = async (title: string, data: any[], type: 'success' | 'error' | 'info' = 'info') => {
  if (type === 'success') {
    toast.success(`${title} - ${data[0]?.value}`);
  } else {
    toast.error(`${title} - ${data[0]?.value}`);
  }
};

export function Marketplace() {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Checkout State
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [buyQuantity, setBuyQuantity] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [vendorDetails, setVendorDetails] = useState<any>(null);

  const EXPECTED_CHAIN_ID = 5042002;
  const isCorrectNetwork = chainId === EXPECTED_CHAIN_ID;

  useEffect(() => {
    fetchGlobalProducts();
  }, []);

  const fetchGlobalProducts = async () => {
    try {
      setLoading(true);
      // Fetch products that have stock > 0
      const { data, error } = await supabase
        .from('market_products')
        .select(`
          *,
          vendor_profiles:vendor_wallet (
            store_name,
            roles,
            logo_url
          )
        `)
        .gt('quantity', 0)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openCheckout = async (product: any) => {
    if (!isConnected) return toast.error('Please connect your wallet first');
    if (!isCorrectNetwork) return toast.error('Switch to Arc Testnet to purchase');
    
    setSelectedProduct(product);
    setBuyQuantity(1);
    
    // Fetch vendor details
    const { data } = await supabase.from('vendor_profiles').select('*').eq('wallet', product.vendor_wallet).single();
    if (data) setVendorDetails(data);
  };

  const closeCheckout = () => {
    setSelectedProduct(null);
    setVendorDetails(null);
    setBuyQuantity(1);
  };

  const executePurchase = async () => {
    if (!address || !selectedProduct) return;
    
    const subtotal = selectedProduct.price * buyQuantity;
    const totalAmount = subtotal + Number(selectedProduct.shipping_fee || 0);
    
    setIsProcessing(true);
    const toastId = toast.loading(`Initiating ArcPay Secure Checkout...`);

    try {
      // Execute payment in USDC
      const value = parseUnits(totalAmount.toString(), ARCSLOTS_TOKENS.USDC_DECIMALS);
      const hash = await writeContractAsync({
        address: ARCSLOTS_TOKENS.USDC_ADDRESS as `0x${string}`,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [selectedProduct.vendor_wallet as `0x${string}`, value]
      });

      toast.loading(`Transaction broadcasted. Verifying...`, { id: toastId });

      // Record Order in Supabase
      const { error: orderError } = await supabase.from('market_orders').insert({
        buyer_wallet: address.toLowerCase(),
        vendor_wallet: selectedProduct.vendor_wallet,
        product_id: selectedProduct.id,
        quantity: buyQuantity,
        total_amount: totalAmount,
        tx_hash: hash
      });
      if (orderError) console.error("Order Insert Error:", orderError);

      // Decrement Inventory Stock
      const newStock = selectedProduct.quantity - buyQuantity;
      await supabase.from('market_products').update({ quantity: newStock }).eq('id', selectedProduct.id);

      // --- GAMIFICATION: Earn Points Engine ---
      // Update buyer volume & points
      const pointsEarned = totalAmount / 10;
      const { data: existingStats } = await supabase.from('user_stats').select('*').eq('wallet', address.toLowerCase()).single();
      
      if (existingStats) {
        await supabase.from('user_stats').update({
          total_volume: Number(existingStats.total_volume || 0) + totalAmount,
          points: Number(existingStats.points || 0) + pointsEarned
        }).eq('wallet', address.toLowerCase());
      } else {
        await supabase.from('user_stats').insert({
          wallet: address.toLowerCase(),
          total_volume: totalAmount,
          points: pointsEarned
        });
      }

      // Check for $500 milestone (Seller/Buyer volume check logic could go here; granting simple buyer volume reward for now)
      if (existingStats && Number(existingStats.total_volume || 0) + totalAmount >= 500) {
        // If they just crossed 500, we could add a one-time bonus. For now, tracking points linearly.
        toast.success(`🎉 You've earned ${pointsEarned.toFixed(2)} points from this purchase!`, { duration: 5000 });
      }

      toast.success(`Purchase successful! Hash: ${hash.slice(0, 10)}...`, { id: toastId });
      closeCheckout();
      fetchGlobalProducts(); // Refresh stock

    } catch (err: any) {
      console.error(err);
      toast.error(err.shortMessage || err.message || 'Checkout failed', { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[var(--accent-cyan)] size-10" /></div>;
  }

  return (
    <div className="space-y-8">
      {/* Search / Filter Header */}
      <div className="stat-box rounded-[32px] p-6 flex flex-col sm:flex-row gap-4 justify-between items-center bg-[rgba(6,8,20,0.8)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--accent-cyan)] opacity-10 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-12 h-12 rounded-xl bg-[rgba(0,242,254,0.1)] flex items-center justify-center text-[var(--accent-cyan)] border border-[rgba(0,242,254,0.2)]">
            <ShoppingCart size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black text-[var(--text-primary)]">Global Market</h2>
            <p className="text-xs text-[var(--text-secondary)] font-semibold mt-0.5">Discover decentralized products & services</p>
          </div>
        </div>
        <div className="w-full sm:w-auto relative z-10">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={16} />
          <input type="text" placeholder="Search products..." className="w-full sm:w-64 cyber-input pl-11 pr-4 py-3 rounded-xl text-sm outline-none" />
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {products.length === 0 ? (
          <div className="col-span-full stat-box p-12 text-center text-[var(--text-secondary)]">No products available. Check back later!</div>
        ) : (
          products.map(p => (
            <div key={p.id} className="stat-box rounded-[24px] overflow-hidden flex flex-col group hover:border-[var(--accent-cyan)] transition-colors cursor-pointer" onClick={() => openCheckout(p)}>
              <div className="h-48 bg-[rgba(6,8,20,0.8)] relative overflow-hidden">
                {p.images?.[0] ? (
                  <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[rgba(6,8,20,0.5)]"><Star className="text-slate-600" size={32} /></div>
                )}
                <div className="absolute top-3 left-3 bg-black/60 backdrop-blur px-2 py-1 rounded text-[9px] font-black text-white border border-white/10 uppercase tracking-widest">
                  {p.category}
                </div>
                {p.quantity <= 5 && (
                  <div className="absolute top-3 right-3 bg-red-500/80 backdrop-blur px-2 py-1 rounded text-[10px] font-black text-white border border-red-500/20">
                    Only {p.quantity} Left
                  </div>
                )}
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex items-center gap-2 mb-3">
                  <img src={p.vendor_profiles?.logo_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${p.vendor_wallet}`} className="w-5 h-5 rounded bg-slate-800" alt="" />
                  <span className="text-[10px] text-[var(--text-secondary)] font-bold truncate">{p.vendor_profiles?.store_name || 'Verified Vendor'}</span>
                </div>
                <h4 className="font-black text-[var(--text-primary)] text-sm mb-1 leading-tight">{p.name}</h4>
                <div className="mt-auto pt-4 flex items-end justify-between">
                  <div>
                    <span className="text-xs text-[var(--text-secondary)] font-semibold block mb-0.5">Price</span>
                    <span className="text-lg font-black text-[var(--accent-cyan)]">${p.price}</span>
                  </div>
                  <button className="bg-[rgba(0,242,254,0.1)] text-[var(--accent-cyan)] px-4 py-2 rounded-lg text-xs font-bold hover:bg-[rgba(0,242,254,0.2)] transition-colors">
                    Buy
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ArcPay Secure Checkout Overlay */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="stat-box max-w-lg w-full rounded-[32px] overflow-hidden shadow-2xl border border-[var(--accent-cyan)]">
            <div className="p-6 sm:p-8 bg-gradient-to-b from-[rgba(0,242,254,0.05)] to-transparent">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-xl font-black text-[var(--text-primary)]">Secure Checkout</h3>
                  <p className="text-xs text-[var(--accent-cyan)] font-semibold flex items-center gap-1 mt-1">
                    <ShieldCheck size={14} /> ArcPay Buyer Protection
                  </p>
                </div>
                <button onClick={closeCheckout} className="text-[var(--text-secondary)] hover:text-white p-2">✕</button>
              </div>

              {/* Product Info */}
              <div className="flex gap-4 mb-6 p-4 bg-[rgba(6,8,20,0.5)] border border-[var(--border-dim)] rounded-2xl">
                <img src={selectedProduct.images?.[0] || ''} className="w-16 h-16 rounded-xl object-cover bg-black" alt="" />
                <div>
                  <h4 className="text-sm font-black text-white">{selectedProduct.name}</h4>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5 mb-2">Sold by: {vendorDetails?.store_name || 'Vendor'}</p>
                  <span className="text-sm font-extrabold text-[var(--accent-cyan)]">${selectedProduct.price}</span>
                </div>
              </div>

              {/* Quantity Selector */}
              <div className="flex items-center justify-between mb-6">
                <span className="text-xs font-bold text-[var(--text-secondary)]">Select Quantity</span>
                <div className="flex items-center gap-4 bg-[rgba(6,8,20,0.5)] border border-[var(--border-dim)] rounded-xl p-1">
                  <button 
                    onClick={() => setBuyQuantity(Math.max(1, buyQuantity - 1))}
                    className="w-8 h-8 flex items-center justify-center text-white hover:bg-[rgba(255,255,255,0.1)] rounded-lg transition-colors"
                  >-</button>
                  <span className="font-black w-4 text-center text-sm text-white">{buyQuantity}</span>
                  <button 
                    onClick={() => setBuyQuantity(Math.min(selectedProduct.quantity, buyQuantity + 1))}
                    className="w-8 h-8 flex items-center justify-center text-white hover:bg-[rgba(255,255,255,0.1)] rounded-lg transition-colors"
                  >+</button>
                </div>
              </div>

              {/* Order Summary */}
              <div className="space-y-3 pt-4 border-t border-[var(--border-dim)]">
                <div className="flex justify-between text-xs font-medium text-[var(--text-secondary)]">
                  <span>Subtotal ({buyQuantity} items)</span>
                  <span>${(selectedProduct.price * buyQuantity).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs font-medium text-[var(--text-secondary)]">
                  <span>Shipping Fee</span>
                  <span>{selectedProduct.shipping_fee ? `$${selectedProduct.shipping_fee.toFixed(2)}` : 'Free'}</span>
                </div>
                <div className="flex justify-between items-end pt-3">
                  <span className="text-sm font-bold text-white">Total Amount</span>
                  <div className="text-right">
                    <span className="text-2xl font-black text-[var(--accent-cyan)]">${((selectedProduct.price * buyQuantity) + Number(selectedProduct.shipping_fee || 0)).toFixed(2)}</span>
                    <span className="block text-[10px] text-[var(--text-secondary)] font-semibold uppercase mt-0.5">Pay in USDC</span>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="mt-8">
                <button
                  onClick={executePurchase}
                  disabled={isProcessing}
                  className="deploy-btn w-full py-4 text-sm font-black tracking-wide uppercase flex justify-center items-center gap-2 rounded-xl"
                >
                  {isProcessing ? <Loader2 className="animate-spin" size={18} /> : <CreditCard size={18} />}
                  {isProcessing ? 'Processing via ArcPay...' : 'Pay Securely Now'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
