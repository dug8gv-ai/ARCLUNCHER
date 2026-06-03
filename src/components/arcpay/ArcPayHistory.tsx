'use client';

import React, { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { supabase } from '@/lib/supabase';
import { MessageCircle, ArrowRight, Loader2, Inbox } from 'lucide-react';

interface Conversation {
  wallet: string;
  name: string;
  avatar: string;
  lastMessage: string;
  lastTime: string;
  unreadHint: boolean;
}

interface ArcPayHistoryProps {
  onOpenProfile?: (username: string) => void;
}

export function ArcPayHistory({ onOpenProfile }: ArcPayHistoryProps) {
  const { address } = useAccount();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const myAddr = address?.toLowerCase() || '';

  useEffect(() => {
    if (!myAddr) return;

    const fetchConversations = async () => {
      setIsLoading(true);

      // Get all messages where I'm sender or receiver
      const { data: messages, error } = await supabase
        .from('arcpay_chats')
        .select('*')
        .or(`sender_wallet.eq.${myAddr},receiver_wallet.eq.${myAddr}`)
        .order('created_at', { ascending: false })
        .limit(200);

      if (error || !messages || messages.length === 0) {
        setConversations([]);
        setIsLoading(false);
        return;
      }

      // Group by counterparty wallet
      const convMap = new Map<string, { lastMsg: string; lastTime: string; isIncoming: boolean }>();
      
      for (const msg of messages) {
        const counterparty = msg.sender_wallet.toLowerCase() === myAddr
          ? msg.receiver_wallet.toLowerCase()
          : msg.sender_wallet.toLowerCase();

        if (!convMap.has(counterparty)) {
          convMap.set(counterparty, {
            lastMsg: msg.message,
            lastTime: msg.created_at,
            isIncoming: msg.sender_wallet.toLowerCase() !== myAddr,
          });
        }
      }

      // Fetch profiles for all counterparties
      const wallets = Array.from(convMap.keys());
      const { data: profiles } = await supabase
        .from('profiles')
        .select('wallet, name, avatar')
        .in('wallet', wallets);

      const profileMap = new Map<string, { name: string; avatar: string }>();
      if (profiles) {
        for (const p of profiles) {
          profileMap.set(p.wallet.toLowerCase(), { name: p.name, avatar: p.avatar });
        }
      }

      // Build conversation list
      const convList: Conversation[] = [];
      for (const [wallet, info] of convMap.entries()) {
        const profile = profileMap.get(wallet);
        convList.push({
          wallet,
          name: profile?.name || `${wallet.slice(0, 6)}...${wallet.slice(-4)}`,
          avatar: profile?.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${wallet}`,
          lastMessage: info.lastMsg,
          lastTime: info.lastTime,
          unreadHint: info.isIncoming,
        });
      }

      setConversations(convList);
      setIsLoading(false);
    };

    fetchConversations();

    // Realtime: refresh when new messages arrive
    const channel = supabase
      .channel('inbox_realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'arcpay_chats',
      }, (payload) => {
        const msg = payload.new as any;
        if (msg.sender_wallet?.toLowerCase() === myAddr || msg.receiver_wallet?.toLowerCase() === myAddr) {
          fetchConversations();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [myAddr]);

  if (!address) {
    return (
      <div className="card rounded-[28px] p-8 text-center">
        <p className="text-sm text-[var(--text-secondary)] font-semibold">Connect wallet to view your inbox</p>
      </div>
    );
  }

  return (
    <div className="card rounded-[28px] overflow-hidden shadow-sm">
      {/* Header */}
      <div className="p-5 border-b border-[var(--border-dim)] flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-[rgba(0,242,254,0.05)] border border-[var(--border-dim)] flex items-center justify-center">
          <Inbox size={18} className="text-[var(--accent-cyan)]" />
        </div>
        <div>
          <h3 className="text-sm font-black text-[var(--text-primary)]">Inbox</h3>
          <p className="text-[10px] text-[var(--text-secondary)] font-semibold">Recent conversations & payments</p>
        </div>
      </div>

      {/* Content */}
      <div className="max-h-[400px] overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="animate-spin text-blue-400" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center p-12 space-y-3">
            <MessageCircle size={32} className="text-slate-300 mx-auto" />
            <p className="text-xs text-[var(--text-secondary)] font-semibold">No conversations yet</p>
            <p className="text-[10px] text-slate-300">Search a username above to start chatting</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {conversations.map((conv) => (
              <button
                key={conv.wallet}
                onClick={() => onOpenProfile?.(conv.name)}
                className="w-full p-4 hover:bg-[rgba(0,242,254,0.05)] transition-colors flex items-center gap-3.5 text-left group cursor-pointer"
              >
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-[var(--border-dim)]">
                    <img
                      src={conv.avatar}
                      alt={conv.name}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/bottts/svg?seed=${conv.wallet}`;
                      }}
                    />
                  </div>
                  {conv.unreadHint && (
                    <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-blue-600 border-2 border-white rounded-full" />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="text-sm font-bold text-[var(--text-primary)] truncate">{conv.name}</span>
                    <span className="text-[9px] text-[var(--text-secondary)] font-semibold flex-shrink-0 ml-2">
                      {formatTimeAgo(conv.lastTime)}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] truncate font-medium">{conv.lastMessage}</p>
                </div>

                {/* Arrow */}
                <ArrowRight size={14} className="text-slate-300 group-hover:text-[var(--accent-cyan)] transition-colors flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
