'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Award, DollarSign, Disc, ExternalLink } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const XIcon = () => (
  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

export function AffiliatesView() {
  const [affiliates, setAffiliates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAffiliates = async () => {
    try {
      setLoading(true);
      
      // 1. Fetch profiles where is_affiliate is true
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_affiliate', true);

      if (profilesError) throw profilesError;

      if (profilesData && profilesData.length > 0) {
        // 2. Fetch user stats for these wallets to enrich cards with points/volume
        const wallets = profilesData.map(p => p.wallet.toLowerCase());
        const { data: statsData } = await supabase
          .from('user_stats')
          .select('*')
          .in('wallet', wallets);

        const enriched = profilesData.map(profile => {
          const stats = statsData?.find(s => s.wallet.toLowerCase() === profile.wallet.toLowerCase());
          return {
            ...profile,
            points: stats?.points || 0,
            total_volume: stats?.total_volume || 0,
            avatar: profile.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${profile.wallet}`
          };
        });

        // Order by points descending
        enriched.sort((a, b) => b.points - a.points);
        setAffiliates(enriched);
      } else {
        setAffiliates([]);
      }
    } catch (err) {
      console.error("Error fetching affiliates:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAffiliates();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div>
        <h2 className="text-2xl font-black text-[var(--text-primary)] flex items-center gap-2.5">
          <Users className="text-[var(--accent-cyan)]" size={24} />
          Partner Affiliates
        </h2>
        <p className="text-xs text-[var(--text-secondary)] font-semibold mt-1">
          Meet our verified partner affiliates and community leaders driving volume and building liquidity.
        </p>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-[var(--text-secondary)] font-bold uppercase tracking-wider">Loading verified partners...</p>
        </div>
      ) : affiliates.length === 0 ? (
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="card rounded-[32px] p-10 text-center space-y-4 max-w-lg mx-auto shadow-sm"
        >
          <div className="w-16 h-16 rounded-full bg-[rgba(0,242,254,0.05)] text-[var(--accent-cyan)] flex items-center justify-center mx-auto shadow-inner">
            <Users size={28} />
          </div>
          <div className="space-y-1">
            <h3 className="font-extrabold text-[var(--text-primary)] text-base">No Partner Affiliates Yet</h3>
            <p className="text-xs text-[var(--text-secondary)] font-semibold leading-relaxed">
              Our verified partner affiliate network is currently open for top traders. Contact the admin to grant your affiliate badge.
            </p>
          </div>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {affiliates.map((partner, index) => (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.08 }}
              key={partner.wallet}
              className="bg-[var(--bg-card)]/80 backdrop-blur-sm border border-[var(--border-dim)] rounded-[32px] p-6 hover:shadow-xl hover:border-blue-300 transition-all duration-300 flex flex-col justify-between group relative overflow-hidden"
            >
              {/* Decorative top gradient accent */}
              <div className="absolute top-0 left-0 right-0 h-1.5 btn-primary" />
              
              <div className="space-y-4">
                {/* Header Profile Info */}
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl overflow-hidden bg-slate-50 border border-[var(--border-dim)] shadow-sm flex-shrink-0">
                    <img src={partner.avatar} alt={partner.name} className="w-full h-full object-contain p-0.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-black text-[var(--text-primary)] text-sm truncate">{partner.name}</h4>
                      <span className="text-[8px] btn-primary text-white px-2 py-0.5 rounded-full font-black uppercase tracking-wider flex-shrink-0">
                        Partner
                      </span>
                    </div>
                    <p className="text-[10px] text-[var(--text-secondary)] font-mono mt-0.5">
                      {partner.wallet.slice(0, 6)}...{partner.wallet.slice(-4)}
                    </p>
                  </div>
                </div>

                {/* Partner Stats */}
                <div className="grid grid-cols-2 gap-3 bg-slate-50/50 border border-[var(--border-dim)] rounded-2xl p-3 text-xs font-semibold">
                  <div className="space-y-0.5">
                    <span className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest flex items-center gap-1">
                      <DollarSign size={10} className="text-[var(--text-secondary)]" />
                      Traded Volume
                    </span>
                    <span className="text-[var(--text-primary)] font-extrabold block">
                      ${Number(partner.total_volume || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[8px] font-black text-[var(--text-secondary)] uppercase tracking-widest flex items-center gap-1">
                      <Award size={10} className="text-[var(--accent-cyan)]" />
                      ARCL Points
                    </span>
                    <span className="text-[var(--accent-cyan)] font-black block">
                      {Number(partner.points || 0).toFixed(1)} pts
                    </span>
                  </div>
                </div>
              </div>

              {/* Social Channels & Links */}
              <div className="flex items-center justify-between border-t border-[var(--border-dim)] mt-5 pt-4">
                <div className="flex items-center gap-2">
                  {partner.twitter && (
                    <a
                      href={`https://x.com/${partner.twitter.replace('@', '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-8 h-8 rounded-xl bg-slate-50 border border-[var(--border-dim)] hover:bg-[rgba(0,242,254,0.05)] hover:text-[#1DA1F2] hover:border-[var(--border-dim)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                      title="Follow on X"
                    >
                      <XIcon />
                    </a>
                  )}
                  {partner.discord && (
                    <div
                      className="w-8 h-8 rounded-xl bg-slate-50 border border-[var(--border-dim)] hover:bg-indigo-50 hover:text-[#5865F2] hover:border-indigo-200 flex items-center justify-center text-[var(--text-secondary)] transition-colors cursor-pointer"
                      title={`Discord: ${partner.discord}`}
                      onClick={() => alert(`Discord Handle: ${partner.discord}`)}
                    >
                      <Disc size={14} />
                    </div>
                  )}
                </div>

                <a 
                  href={`https://explorer.arc.net/address/${partner.wallet}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[9px] font-black text-[var(--accent-cyan)] group-hover:text-[var(--accent-cyan)] transition-colors uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                >
                  Explorer
                  <ExternalLink size={10} />
                </a>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
