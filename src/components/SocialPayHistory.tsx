'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { supabase } from '@/lib/supabase';
import {
  ArrowUpRight, ArrowDownLeft, ExternalLink,
  Loader2, RefreshCw, Search, Filter,
  TrendingUp, TrendingDown, Wallet, Clock,
  Copy, Check, ChevronDown
} from 'lucide-react';

interface TxItem {
  id: string;
  sender_wallet: string;
  receiver_wallet: string;
  amount: number;
  asset_type: string;
  tx_hash: string;
  created_at: string;
  isSent: boolean;
  counterpartyWallet: string;
  counterpartyProfile: {
    name: string;
    avatar: string;
    wallet: string;
    discord?: string;
    twitter?: string;
  };
}

export function SocialPayHistory() {
  const { address: userAddress } = useAccount();
  const [txs, setTxs]           = useState<TxItem[]>([]);
  const [filtered, setFiltered] = useState<TxItem[]>([]);
  const [loading, setLoading]   = useState(false);
  const [search, setSearch]     = useState('');
  const [filter, setFilter]     = useState<'all' | 'sent' | 'received'>('all');
  const [copied, setCopied]     = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!userAddress) return;
    setLoading(true);
    try {
      const walletLower = userAddress.toLowerCase();
      const { data, error } = await supabase
        .from('social_transactions')
        .select('*')
        .or(`sender_wallet.eq.${walletLower},receiver_wallet.eq.${walletLower}`)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error || !data) return;

      // collect all counterparty wallets
      const wallets = new Set<string>();
      data.forEach(tx => {
        const cp = tx.sender_wallet === walletLower ? tx.receiver_wallet : tx.sender_wallet;
        wallets.add(cp);
      });

      let profilesMap: Record<string, any> = {};
      if (wallets.size > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('wallet, name, avatar, discord, twitter')
          .in('wallet', Array.from(wallets));
        if (profs) profs.forEach(p => { profilesMap[p.wallet] = p; });
      }

      const enriched: TxItem[] = data.map(tx => {
        const isSent = tx.sender_wallet === walletLower;
        const cpWallet = isSent ? tx.receiver_wallet : tx.sender_wallet;
        const profile = profilesMap[cpWallet] || {
          name: cpWallet.slice(0, 6) + '...' + cpWallet.slice(-4),
          avatar: `https://api.dicebear.com/7.x/bottts/svg?seed=${cpWallet}`,
          wallet: cpWallet,
        };
        return { ...tx, isSent, counterpartyWallet: cpWallet, counterpartyProfile: profile };
      });

      setTxs(enriched);
      setFiltered(enriched);
    } catch (err) {
      console.error('fetchHistory error:', err);
    } finally {
      setLoading(false);
    }
  }, [userAddress]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // filter + search
  useEffect(() => {
    let list = txs;
    if (filter === 'sent')     list = list.filter(t => t.isSent);
    if (filter === 'received') list = list.filter(t => !t.isSent);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.counterpartyProfile.name.toLowerCase().includes(q) ||
        t.counterpartyWallet.toLowerCase().includes(q) ||
        t.asset_type.toLowerCase().includes(q)
      );
    }
    setFiltered(list);
  }, [txs, filter, search]);

  // stats
  const totalSent     = txs.filter(t => t.isSent).reduce((s, t) => s + t.amount, 0);
  const totalReceived = txs.filter(t => !t.isSent).reduce((s, t) => s + t.amount, 0);
  const txCount       = txs.length;
  const uniquePeers   = new Set(txs.map(t => t.counterpartyWallet)).size;

  const copyHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopied(hash);
    setTimeout(() => setCopied(null), 1500);
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diff = (now.getTime() - d.getTime()) / 1000;
    if (diff < 60)   return `${Math.floor(diff)}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return d.toLocaleDateString();
  };

  if (!userAddress) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <Wallet size={32} style={{ color: 'var(--accent-cyan)', opacity: 0.4 }} />
      <p style={{ color: 'var(--text-secondary)', fontFamily: 'Orbitron, sans-serif', fontSize: 12, letterSpacing: 2 }}>
        CONNECT WALLET TO VIEW HISTORY
      </p>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Stats Row ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'TOTAL TXS',     value: txCount,                       icon: <Clock size={14} />,        color: '#00e5ff' },
          { label: 'TOTAL SENT',    value: totalSent.toFixed(2),           icon: <ArrowUpRight size={14} />, color: '#ff4081' },
          { label: 'TOTAL RECEIVED',value: totalReceived.toFixed(2),       icon: <ArrowDownLeft size={14} />,color: '#00e676' },
          { label: 'UNIQUE PEERS',  value: uniquePeers,                    icon: <Wallet size={14} />,       color: '#ffd740' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '14px 16px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ fontSize: 9, letterSpacing: 2, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8, fontFamily: 'Orbitron, sans-serif' }}>
              {s.label}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: s.color }}>{s.icon}</span>
              <span style={{ fontFamily: 'Orbitron, sans-serif', fontWeight: 900, fontSize: 20, color: s.color }}>
                {s.value}
              </span>
            </div>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${s.color}, transparent)` }} />
          </div>
        ))}
      </div>

      {/* ── Search + Filter + Refresh ── */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, wallet, or token..."
            style={{
              width: '100%', boxSizing: 'border-box',
              paddingLeft: 34, paddingRight: 12, paddingTop: 9, paddingBottom: 9,
              background: 'rgba(4,6,28,0.9)',
              border: '1px solid var(--border-dim)',
              borderRadius: 8, color: 'var(--text-primary)',
              fontSize: 12, fontFamily: 'Rajdhani, sans-serif',
              outline: 'none',
            }}
          />
        </div>

        {/* Filter pills */}
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'sent', 'received'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding: '7px 14px',
                borderRadius: 8,
                border: filter === f ? '1px solid var(--accent-cyan)' : '1px solid var(--border-dim)',
                background: filter === f ? 'rgba(0,229,255,0.1)' : 'rgba(4,6,28,0.8)',
                color: filter === f ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                fontSize: 10,
                fontFamily: 'Orbitron, sans-serif',
                letterSpacing: 1,
                cursor: 'pointer',
                textTransform: 'uppercase',
                transition: 'all 0.15s',
              }}
            >
              {f}
            </button>
          ))}
        </div>

        <button
          onClick={fetchHistory}
          disabled={loading}
          style={{
            padding: '8px 10px',
            borderRadius: 8,
            border: '1px solid var(--border-dim)',
            background: 'rgba(4,6,28,0.8)',
            color: 'var(--accent-cyan)',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center',
          }}
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* ── Transaction List ── */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 12 }}>
          <Loader2 size={24} style={{ color: 'var(--accent-cyan)' }} className="animate-spin" />
          <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: 10, letterSpacing: 2, color: 'var(--text-muted)' }}>
            LOADING TRANSACTIONS...
          </span>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 10 }}>
          <Clock size={28} style={{ color: 'var(--text-muted)', opacity: 0.4 }} />
          <p style={{ color: 'var(--text-secondary)', fontFamily: 'Orbitron, sans-serif', fontSize: 11, letterSpacing: 2 }}>
            NO TRANSACTIONS FOUND
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: 11 }}>
            Send your first payment to see history here
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(tx => (
            <div
              key={tx.id}
              style={{
                background: 'rgba(6,10,38,0.75)',
                border: `1px solid ${expanded === tx.id ? 'rgba(0,229,255,0.3)' : 'var(--border-dim)'}`,
                borderRadius: 12,
                overflow: 'hidden',
                transition: 'border-color 0.2s',
              }}
            >
              {/* Main row */}
              <div
                style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', gap: 14, cursor: 'pointer' }}
                onClick={() => setExpanded(expanded === tx.id ? null : tx.id)}
              >
                {/* Direction icon */}
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: tx.isSent ? 'rgba(255,64,129,0.12)' : 'rgba(0,230,118,0.12)',
                  border: `1px solid ${tx.isSent ? 'rgba(255,64,129,0.3)' : 'rgba(0,230,118,0.3)'}`,
                  color: tx.isSent ? '#ff4081' : '#00e676',
                }}>
                  {tx.isSent ? <ArrowUpRight size={16} /> : <ArrowDownLeft size={16} />}
                </div>

                {/* Profile */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                  <div style={{ position: 'relative' }}>
                    <img
                      src={tx.counterpartyProfile.avatar}
                      alt=""
                      style={{
                        width: 38, height: 38, borderRadius: '50%',
                        border: `2px solid ${tx.isSent ? 'rgba(255,64,129,0.3)' : 'rgba(0,230,118,0.3)'}`,
                        background: 'rgba(4,6,28,0.9)',
                      }}
                      onError={e => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/bottts/svg?seed=${tx.counterpartyWallet}`; }}
                    />
                    <div style={{
                      position: 'absolute', bottom: -2, right: -2,
                      width: 10, height: 10, borderRadius: '50%',
                      background: '#00e676',
                      border: '2px solid #04061a',
                    }} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', fontFamily: 'Rajdhani, sans-serif' }}>
                      {tx.counterpartyProfile.name}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      {tx.counterpartyWallet.slice(0, 8)}...{tx.counterpartyWallet.slice(-6)}
                    </div>
                  </div>
                </div>

                {/* Direction label */}
                <div style={{
                  padding: '3px 10px',
                  borderRadius: 4,
                  fontSize: 9,
                  fontFamily: 'Orbitron, sans-serif',
                  letterSpacing: 1,
                  fontWeight: 700,
                  background: tx.isSent ? 'rgba(255,64,129,0.08)' : 'rgba(0,230,118,0.08)',
                  color: tx.isSent ? '#ff4081' : '#00e676',
                  border: `1px solid ${tx.isSent ? 'rgba(255,64,129,0.2)' : 'rgba(0,230,118,0.2)'}`,
                }}>
                  {tx.isSent ? 'SENT' : 'RECEIVED'}
                </div>

                {/* Amount */}
                <div style={{ textAlign: 'right', minWidth: 90 }}>
                  <div style={{
                    fontFamily: 'Orbitron, sans-serif',
                    fontWeight: 900,
                    fontSize: 15,
                    color: tx.isSent ? '#ff4081' : '#00e676',
                  }}>
                    {tx.isSent ? '-' : '+'}{tx.amount}
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: 1, fontFamily: 'Orbitron, sans-serif' }}>
                    {tx.asset_type}
                  </div>
                </div>

                {/* Time */}
                <div style={{ textAlign: 'right', minWidth: 55 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{formatTime(tx.created_at)}</div>
                </div>

                <ChevronDown
                  size={14}
                  style={{
                    color: 'var(--text-muted)',
                    transform: expanded === tx.id ? 'rotate(180deg)' : 'rotate(0)',
                    transition: 'transform 0.2s',
                  }}
                />
              </div>

              {/* Expanded detail */}
              {expanded === tx.id && (
                <div style={{
                  padding: '12px 16px 16px',
                  borderTop: '1px solid var(--border-dim)',
                  background: 'rgba(4,6,26,0.5)',
                  display: 'flex', flexDirection: 'column', gap: 10,
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: 2, marginBottom: 4, fontFamily: 'Orbitron, sans-serif' }}>
                        {tx.isSent ? 'SENT TO' : 'FROM'}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                        {tx.counterpartyWallet}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: 2, marginBottom: 4, fontFamily: 'Orbitron, sans-serif' }}>
                        DATE & TIME
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                        {new Date(tx.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* TX Hash */}
                  <div>
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', letterSpacing: 2, marginBottom: 6, fontFamily: 'Orbitron, sans-serif' }}>
                      TRANSACTION HASH
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <code style={{
                        fontSize: 10, color: 'var(--accent-cyan)',
                        background: 'rgba(0,229,255,0.04)',
                        border: '1px solid rgba(0,229,255,0.12)',
                        borderRadius: 6, padding: '4px 10px',
                        fontFamily: 'monospace', flex: 1,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {tx.tx_hash}
                      </code>
                      <button
                        onClick={() => copyHash(tx.tx_hash)}
                        style={{
                          padding: '5px 8px', borderRadius: 6,
                          border: '1px solid var(--border-dim)',
                          background: 'rgba(4,6,28,0.9)',
                          color: copied === tx.tx_hash ? '#00e676' : 'var(--text-muted)',
                          cursor: 'pointer', display: 'flex', alignItems: 'center',
                        }}
                      >
                        {copied === tx.tx_hash ? <Check size={12} /> : <Copy size={12} />}
                      </button>
                      <a
                        href={`https://testnet.arc.network/tx/${tx.tx_hash}`}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          padding: '5px 8px', borderRadius: 6,
                          border: '1px solid var(--border-dim)',
                          background: 'rgba(4,6,28,0.9)',
                          color: 'var(--accent-cyan)',
                          display: 'flex', alignItems: 'center',
                          textDecoration: 'none',
                        }}
                      >
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
