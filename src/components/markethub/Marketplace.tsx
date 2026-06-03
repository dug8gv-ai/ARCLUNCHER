'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAccount, useSendTransaction, useWriteContract, useChainId } from 'wagmi';
import { parseUnits, parseEther, erc20Abi, isAddress } from 'viem';
import { Loader2, ShoppingCart, ShieldCheck, MapPin, Search, Star, CreditCard, CheckCircle2, MessageSquare, Filter, Plus, Minus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { ARCSLOTS_TOKENS } from '@/lib/arcslots/arcslots.constants';

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
  const { writeContractAsync } = useWriteContract();

  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const categories = ['All', 'Electronics', 'Fashion', 'Digital', 'Services', 'Art', 'Other'];
  
  // Cart State
  const [cart, setCart] = useState<any[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Product Details / Reviews State
  const [viewingProduct, setViewingProduct] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newReviewText, setNewReviewText] = useState('');

  const EXPECTED_CHAIN_ID = 5042002;
  const isCorrectNetwork = chainId === EXPECTED_CHAIN_ID;

  useEffect(() => {
    fetchGlobalProducts();
  }, []);

  const fetchGlobalProducts = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('market_products')
        .select(`
          *,
          vendor_profiles:vendor_wallet (
            store_name,
            roles,
            logo_url
          ),
          product_reviews (
            rating
          )
        `)
        .gt('quantity', 0)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Calculate average ratings
      const enhancedData = (data || []).map(p => {
        const revs = p.product_reviews || [];
        const avgRating = revs.length > 0 ? (revs.reduce((sum: number, r: any) => sum + r.rating, 0) / revs.length).toFixed(1) : null;
        return { ...p, avgRating, totalReviews: revs.length };
      });
      
      setProducts(enhancedData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchReviews = async (productId: string) => {
    try {
      setReviewsLoading(true);
      const { data, error } = await supabase
        .from('product_reviews')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setReviews(data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setReviewsLoading(false);
    }
  };

  const openProductDetails = (product: any) => {
    setViewingProduct(product);
    fetchReviews(product.id);
  };

  const submitReview = async () => {
    if (!address) return toast.error('Please connect your wallet');
    if (!newReviewText.trim()) return toast.error('Please enter a review');
    try {
      const { error } = await supabase.from('product_reviews').insert({
        product_id: viewingProduct.id,
        reviewer_wallet: address.toLowerCase(),
        rating: newRating,
        comment: newReviewText.trim()
      });
      if (error) throw error;
      toast.success('Review submitted!');
      setNewReviewText('');
      fetchReviews(viewingProduct.id);
      fetchGlobalProducts();
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit review');
    }
  };

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.buyQuantity >= product.quantity) {
          toast.error('Maximum stock reached');
          return prev;
        }
        return prev.map(item => item.id === product.id ? { ...item, buyQuantity: item.buyQuantity + 1 } : item);
      }
      return [...prev, { ...product, buyQuantity: 1 }];
    });
    toast.success('Added to Cart');
  };

  const updateCartQuantity = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQ = item.buyQuantity + delta;
        if (newQ < 1) return item;
        if (newQ > item.quantity) {
          toast.error('Maximum stock reached');
          return item;
        }
        return { ...item, buyQuantity: newQ };
      }
      return item;
    }));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const cartSubtotal = cart.reduce((sum, item) => sum + (item.price * item.buyQuantity), 0);
  const cartShipping = cart.reduce((sum, item) => sum + Number(item.shipping_fee || 0), 0); // Flat shipping fee per unique item for now
  const cartTotal = cartSubtotal + cartShipping;

  const executeCartCheckout = async () => {
    if (!address || cart.length === 0) return;
    if (!isCorrectNetwork) return toast.error('Switch to Arc Testnet to purchase');
    
    setIsProcessing(true);
    let successfulItems = 0;
    let totalPointsEarned = 0;

    for (const item of cart) {
      const totalAmount = (item.price * item.buyQuantity) + Number(item.shipping_fee || 0);
      const toastId = toast.loading(`Purchasing ${item.name}...`);

      try {
        const value = parseUnits(totalAmount.toString(), ARCSLOTS_TOKENS.USDC_DECIMALS);
        const hash = await writeContractAsync({
          address: ARCSLOTS_TOKENS.USDC_ADDRESS as `0x${string}`,
          abi: erc20Abi,
          functionName: 'transfer',
          args: [item.vendor_wallet as `0x${string}`, value]
        });

        toast.loading(`Transaction broadcasted. Verifying...`, { id: toastId });

        // Record Order
        const { error: orderError } = await supabase.from('market_orders').insert({
          buyer_wallet: address.toLowerCase(),
          vendor_wallet: item.vendor_wallet,
          product_id: item.id,
          quantity: item.buyQuantity,
          total_amount: totalAmount,
          tx_hash: hash
        });

        // Decrement Inventory Stock
        const newStock = item.quantity - item.buyQuantity;
        await supabase.from('market_products').update({ quantity: newStock }).eq('id', item.id);

        const pointsEarned = totalAmount / 10;
        totalPointsEarned += pointsEarned;
        
        // Update user stats points
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

        toast.success(`${item.name} purchased!`, { id: toastId });
        successfulItems++;
        
        // Remove from cart state
        setCart(prev => prev.filter(c => c.id !== item.id));
      } catch (err: any) {
        console.error(err);
        toast.error(err.shortMessage || err.message || `Failed to purchase ${item.name}`, { id: toastId });
        // Stop execution if one fails to prevent partial accidental checkouts
        break;
      }
    }

    if (successfulItems > 0) {
      toast.success(`Checkout Complete! Earned ${totalPointsEarned.toFixed(2)} points.`);
      fetchGlobalProducts();
      if (cart.length === 0) setIsCartOpen(false);
    }
    
    setIsProcessing(false);
  };

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || p.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === 'All' || (p.category && p.category.toLowerCase() === activeCategory.toLowerCase());
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[var(--accent-cyan)] size-10" /></div>;
  }

  return (
    <div className="space-y-8 pb-20">
      {/* Search / Filter Header */}
      <div className="stat-box rounded-[32px] p-6 bg-[rgba(6,8,20,0.8)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--accent-cyan)] opacity-10 blur-[100px] rounded-full pointer-events-none"></div>
        
        <div className="flex flex-col md:flex-row gap-6 justify-between items-start md:items-center relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-[rgba(0,242,254,0.1)] flex items-center justify-center text-[var(--accent-cyan)] border border-[rgba(0,242,254,0.2)]">
              <ShoppingCart size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-[var(--text-primary)]">Global Market</h2>
              <p className="text-xs text-[var(--text-secondary)] font-semibold mt-0.5">Discover decentralized products & services</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--text-secondary)]" size={16} />
              <input 
                type="text" 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search products..." 
                className="w-full cyber-input pl-11 pr-4 py-3 rounded-xl text-sm outline-none" 
              />
            </div>
            <button 
              onClick={() => setIsCartOpen(true)}
              className="relative p-3 bg-[rgba(6,8,20,0.5)] border border-[var(--border-dim)] rounded-xl hover:border-[var(--accent-cyan)] transition-colors"
            >
              <ShoppingCart size={20} className="text-[var(--text-primary)]" />
              {cart.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-[var(--bg-card)]">
                  {cart.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Categories Pills */}
        <div className="flex gap-2 overflow-x-auto mt-6 pb-2 scrollbar-hide relative z-10">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`whitespace-nowrap px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeCategory === cat 
                  ? 'bg-[var(--accent-cyan)] text-slate-900 shadow-sm' 
                  : 'bg-[rgba(6,8,20,0.5)] border border-[var(--border-dim)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filteredProducts.length === 0 ? (
          <div className="col-span-full stat-box p-12 text-center text-[var(--text-secondary)]">No products match your criteria.</div>
        ) : (
          filteredProducts.map(p => (
            <div key={p.id} className="stat-box rounded-[24px] overflow-hidden flex flex-col group hover:border-[var(--accent-cyan)] transition-colors">
              <div 
                className="h-48 bg-[rgba(6,8,20,0.8)] relative overflow-hidden cursor-pointer"
                onClick={() => openProductDetails(p)}
              >
                {p.images?.[0] ? (
                  <img src={p.images[0]} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-[rgba(6,8,20,0.5)]"><ShoppingCart className="text-slate-600" size={32} /></div>
                )}
                <div className="absolute top-3 left-3 bg-black/60 backdrop-blur px-2 py-1 rounded text-[9px] font-black text-white border border-white/10 uppercase tracking-widest">
                  {p.category}
                </div>
                {p.avgRating && (
                  <div className="absolute bottom-3 left-3 bg-black/60 backdrop-blur px-2 py-1 rounded text-[10px] font-black text-yellow-400 border border-yellow-500/20 flex items-center gap-1">
                    <Star size={10} fill="currentColor" /> {p.avgRating} ({p.totalReviews})
                  </div>
                )}
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <div className="flex items-center gap-2 mb-3">
                  <img src={p.vendor_profiles?.logo_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${p.vendor_wallet}`} className="w-5 h-5 rounded bg-slate-800" alt="" />
                  <span className="text-[10px] text-[var(--text-secondary)] font-bold truncate">{p.vendor_profiles?.store_name || 'Verified Vendor'}</span>
                </div>
                <h4 
                  className="font-black text-[var(--text-primary)] text-sm mb-1 leading-tight cursor-pointer hover:underline"
                  onClick={() => openProductDetails(p)}
                >
                  {p.name}
                </h4>
                <div className="mt-auto pt-4 flex items-end justify-between border-t border-[var(--border-dim)]">
                  <div>
                    <span className="text-xs text-[var(--text-secondary)] font-semibold block mb-0.5">Price</span>
                    <span className="text-lg font-black text-[var(--accent-cyan)]">${p.price}</span>
                  </div>
                  <button 
                    onClick={() => addToCart(p)}
                    className="bg-[rgba(0,242,254,0.1)] text-[var(--accent-cyan)] px-4 py-2 rounded-lg text-xs font-bold hover:bg-[rgba(0,242,254,0.2)] transition-colors flex items-center gap-2"
                  >
                    <Plus size={14} /> Add
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* CART DRAWER / MODAL */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="stat-box max-w-md w-full rounded-[32px] overflow-hidden shadow-2xl border border-[var(--border-dim)] flex flex-col max-h-[85vh]">
            <div className="p-6 bg-[rgba(6,8,20,0.8)] border-b border-[var(--border-dim)] flex justify-between items-center">
              <h3 className="text-xl font-black text-[var(--text-primary)] flex items-center gap-2">
                <ShoppingCart size={20} className="text-[var(--accent-cyan)]" /> Your Cart
              </h3>
              <button onClick={() => setIsCartOpen(false)} className="text-[var(--text-secondary)] hover:text-white p-2">✕</button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {cart.length === 0 ? (
                <div className="text-center py-10 text-[var(--text-secondary)]">
                  <ShoppingCart size={40} className="mx-auto mb-3 opacity-20" />
                  <p className="font-bold">Your cart is empty.</p>
                </div>
              ) : (
                cart.map(item => (
                  <div key={item.id} className="flex gap-4 p-3 bg-[rgba(6,8,20,0.5)] border border-[var(--border-dim)] rounded-2xl">
                    <img src={item.images?.[0] || ''} className="w-16 h-16 rounded-xl object-cover bg-black" alt="" />
                    <div className="flex-1 flex flex-col">
                      <div className="flex justify-between items-start">
                        <h4 className="text-xs font-black text-white leading-tight">{item.name}</h4>
                        <button onClick={() => removeFromCart(item.id)} className="text-red-400 hover:text-red-300"><Trash2 size={14} /></button>
                      </div>
                      <p className="text-[10px] text-[var(--text-secondary)] mt-0.5 mb-2 truncate">Vendor: {item.vendor_profiles?.store_name}</p>
                      <div className="mt-auto flex items-center justify-between">
                        <span className="text-sm font-extrabold text-[var(--accent-cyan)]">${item.price}</span>
                        <div className="flex items-center gap-2 bg-[rgba(6,8,20,0.8)] rounded-lg p-0.5 border border-[var(--border-dim)]">
                          <button onClick={() => updateCartQuantity(item.id, -1)} className="p-1 hover:bg-[rgba(255,255,255,0.1)] rounded"><Minus size={10} /></button>
                          <span className="text-[10px] font-black w-4 text-center">{item.buyQuantity}</span>
                          <button onClick={() => updateCartQuantity(item.id, 1)} className="p-1 hover:bg-[rgba(255,255,255,0.1)] rounded"><Plus size={10} /></button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-6 bg-gradient-to-t from-[rgba(0,242,254,0.05)] to-[rgba(6,8,20,0.9)] border-t border-[var(--border-dim)]">
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-xs font-medium text-[var(--text-secondary)]">
                  <span>Subtotal</span><span>${cartSubtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs font-medium text-[var(--text-secondary)]">
                  <span>Shipping</span><span>${cartShipping.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-end pt-2 border-t border-[var(--border-dim)]">
                  <span className="text-sm font-bold text-white">Total</span>
                  <span className="text-2xl font-black text-[var(--accent-cyan)]">${cartTotal.toFixed(2)}</span>
                </div>
              </div>
              <button
                onClick={executeCartCheckout}
                disabled={isProcessing || cart.length === 0}
                className="deploy-btn w-full py-4 text-sm font-black tracking-wide uppercase flex justify-center items-center gap-2 rounded-xl disabled:opacity-50"
              >
                {isProcessing ? <Loader2 className="animate-spin" size={18} /> : <CreditCard size={18} />}
                {isProcessing ? 'Processing Payments...' : 'Secure Checkout'}
              </button>
              {cart.length > 1 && (
                <p className="text-[9px] text-center text-amber-500/70 mt-3 font-bold">
                  Note: Multiple vendors require signing multiple transactions.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* PRODUCT DETAILS & REVIEWS MODAL */}
      {viewingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="stat-box max-w-2xl w-full rounded-[32px] overflow-hidden shadow-2xl border border-[var(--border-dim)] flex flex-col max-h-[90vh]">
            <div className="flex-1 overflow-y-auto">
              {/* Cover */}
              <div className="h-64 relative bg-[rgba(6,8,20,0.8)]">
                {viewingProduct.images?.[0] ? (
                  <img src={viewingProduct.images[0]} className="w-full h-full object-cover" alt="" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><ShoppingCart className="text-slate-600 size-16" /></div>
                )}
                <button onClick={() => setViewingProduct(null)} className="absolute top-4 right-4 bg-black/50 hover:bg-black/80 text-white p-2 rounded-full backdrop-blur-md">✕</button>
              </div>
              
              <div className="p-6 md:p-8 space-y-6">
                {/* Info */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-[rgba(0,242,254,0.1)] text-[var(--accent-cyan)] px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest">{viewingProduct.category}</span>
                    {viewingProduct.avgRating && (
                      <span className="flex items-center gap-1 text-yellow-400 text-[10px] font-black bg-yellow-500/10 px-2 py-1 rounded"><Star size={10} fill="currentColor" /> {viewingProduct.avgRating}</span>
                    )}
                  </div>
                  <h2 className="text-2xl font-black text-white">{viewingProduct.name}</h2>
                  <p className="text-sm text-[var(--text-secondary)] mt-2 leading-relaxed">{viewingProduct.description}</p>
                </div>
                
                {/* Vendor & Price */}
                <div className="flex flex-col sm:flex-row justify-between sm:items-center p-4 bg-[rgba(6,8,20,0.5)] border border-[var(--border-dim)] rounded-2xl gap-4">
                  <div className="flex items-center gap-3">
                    <img src={viewingProduct.vendor_profiles?.logo_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${viewingProduct.vendor_wallet}`} className="w-10 h-10 rounded-lg bg-slate-800 object-cover" alt="" />
                    <div>
                      <p className="text-[10px] text-[var(--text-secondary)] font-bold uppercase tracking-wider">Sold By</p>
                      <p className="text-sm font-black text-white">{viewingProduct.vendor_profiles?.store_name}</p>
                    </div>
                  </div>
                  <div className="sm:text-right">
                    <span className="text-2xl font-black text-[var(--accent-cyan)] block">${viewingProduct.price}</span>
                    <span className="text-[10px] text-[var(--text-secondary)] font-semibold">Stock: {viewingProduct.quantity} | Shipping: ${viewingProduct.shipping_fee || '0.00'}</span>
                  </div>
                </div>

                <button 
                  onClick={() => addToCart(viewingProduct)}
                  className="w-full bg-[rgba(0,242,254,0.1)] border border-[rgba(0,242,254,0.2)] hover:bg-[rgba(0,242,254,0.2)] text-[var(--accent-cyan)] py-4 rounded-xl text-sm font-black transition-colors flex items-center justify-center gap-2"
                >
                  <Plus size={18} /> Add to Cart
                </button>

                {/* Reviews Section */}
                <div className="pt-6 border-t border-[var(--border-dim)]">
                  <h3 className="text-lg font-black text-white flex items-center gap-2 mb-4"><MessageSquare size={18} className="text-[var(--text-secondary)]" /> Customer Reviews</h3>
                  
                  {/* Add Review */}
                  <div className="mb-6 bg-[rgba(6,8,20,0.5)] border border-[var(--border-dim)] rounded-2xl p-4">
                    <p className="text-xs font-bold text-[var(--text-secondary)] mb-2">Leave a Rating</p>
                    <div className="flex gap-1 mb-3">
                      {[1,2,3,4,5].map(r => (
                        <Star key={r} size={18} onClick={() => setNewRating(r)} className={`cursor-pointer ${r <= newRating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-600'}`} />
                      ))}
                    </div>
                    <textarea 
                      value={newReviewText} 
                      onChange={e => setNewReviewText(e.target.value)} 
                      placeholder="Write your review here..." 
                      className="w-full cyber-input p-3 rounded-xl text-xs outline-none mb-3 min-h-[60px]"
                    />
                    <button onClick={submitReview} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-xs font-bold transition-colors">Submit Review</button>
                  </div>

                  {/* Reviews List */}
                  <div className="space-y-4">
                    {reviewsLoading ? (
                      <Loader2 className="animate-spin text-[var(--text-secondary)] mx-auto size-6" />
                    ) : reviews.length === 0 ? (
                      <p className="text-xs text-[var(--text-secondary)] text-center py-4">No reviews yet. Be the first!</p>
                    ) : (
                      reviews.map(r => (
                        <div key={r.id} className="border-b border-[var(--border-dim)] pb-4 last:border-0 last:pb-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-mono text-[var(--text-secondary)]">{r.reviewer_wallet.slice(0,6)}...{r.reviewer_wallet.slice(-4)}</span>
                            <div className="flex text-yellow-400 gap-0.5">
                              {[...Array(5)].map((_, i) => <Star key={i} size={10} fill={i < r.rating ? 'currentColor' : 'none'} className={i >= r.rating ? 'text-slate-600' : ''} />)}
                            </div>
                          </div>
                          <p className="text-xs text-[var(--text-primary)] leading-relaxed">{r.comment}</p>
                          <span className="text-[9px] text-slate-500 mt-1 block">{new Date(r.created_at).toLocaleDateString()}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
