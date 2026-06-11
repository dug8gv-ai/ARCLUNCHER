'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Send, Loader2 } from 'lucide-react';
import { useAccount } from 'wagmi';

interface ChatMessage {
  id: string;
  sender_wallet: string;
  receiver_wallet: string;
  message: string;
  is_read?: boolean;
  created_at: string;
}

export function P2PChat({ targetWallet }: { targetWallet: string }) {
  const { address } = useAccount();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const myAddr = address?.toLowerCase() || '';
  const theirAddr = targetWallet.toLowerCase();

  useEffect(() => {
    if (!myAddr || !theirAddr) return;

    const fetchMessages = async () => {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('arcpay_chats')
        .select('*')
        .or(
          `and(sender_wallet.eq.${myAddr},receiver_wallet.eq.${theirAddr}),and(sender_wallet.eq.${theirAddr},receiver_wallet.eq.${myAddr})`
        )
        .order('created_at', { ascending: true })
        .limit(50);

      if (error) {
        console.error('Chat fetch error:', error);
      }
      if (data) {
        setMessages(data);
        
        // Mark any unread messages from them to me as read
        const hasUnread = data.some(m => m.receiver_wallet.toLowerCase() === myAddr && !m.is_read);
        if (hasUnread) {
          await supabase
            .from('arcpay_chats')
            .update({ is_read: true })
            .eq('receiver_wallet', myAddr)
            .eq('sender_wallet', theirAddr)
            .eq('is_read', false);
        }
      }
      setIsLoading(false);
    };

    fetchMessages();

    // Realtime subscription
    const channel = supabase
      .channel(`chat_${myAddr}_${theirAddr}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'arcpay_chats',
        },
        (payload) => {
          const newMsg = payload.new as ChatMessage;
          const senderLower = newMsg.sender_wallet?.toLowerCase();
          const receiverLower = newMsg.receiver_wallet?.toLowerCase();
          // Verify it belongs to this conversation
          if (
            (senderLower === myAddr && receiverLower === theirAddr) ||
            (senderLower === theirAddr && receiverLower === myAddr)
          ) {
            setMessages((prev) => {
              // Avoid duplicates (optimistic + realtime)
              if (prev.some((m) => m.id === newMsg.id)) return prev;
              return [...prev, newMsg];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [myAddr, theirAddr]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !myAddr) return;

    const msg = newMessage.trim();
    setNewMessage('');

    // Optimistic update
    const optimisticMsg: ChatMessage = {
      id: `temp_${Date.now()}`,
      sender_wallet: myAddr,
      receiver_wallet: theirAddr,
      message: msg,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    const { error } = await supabase.from('arcpay_chats').insert({
      sender_wallet: myAddr,
      receiver_wallet: theirAddr,
      message: msg,
    });

    if (error) {
      console.error('Send message error:', error);
      // Remove optimistic message on failure
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
    }
  };

  if (!address) {
    return (
      <div className="p-4 text-[var(--text-secondary)] bg-[var(--bg-elevated)] border border-[var(--border-dim)] rounded-2xl text-center text-xs font-semibold">
        Connect wallet to chat
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[360px] stat-box rounded-2xl overflow-hidden">
      {/* Chat header */}
      <div className="p-3 border-b border-[var(--border-dim)] bg-[var(--bg-card)]">
        <h4 className="text-xs font-black text-[var(--text-primary)] uppercase tracking-wider">Live Secure Chat</h4>
        <p className="text-[10px] text-[var(--text-secondary)] font-mono mt-0.5">
          {theirAddr.slice(0, 6)}...{theirAddr.slice(-4)}
        </p>
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center h-full items-center">
            <Loader2 className="animate-spin text-blue-400" />
          </div>
        ) : messages.length === 0 ? (
          <p className="text-xs text-[var(--text-secondary)] text-center my-auto pt-12">Start the conversation</p>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_wallet.toLowerCase() === myAddr;
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm font-medium ${
                    isMe
                      ? 'bg-[rgba(0,242,254,0.1)] text-[var(--accent-cyan)] border border-[var(--border-dim)] rounded-br-sm shadow-sm'
                      : 'bg-[var(--bg-card)] text-[var(--text-primary)] border border-[var(--border-dim)] rounded-bl-sm shadow-sm'
                  }`}
                >
                  {msg.message}
                  <p className={`text-[9px] mt-1 ${isMe ? 'text-[var(--accent-cyan)] opacity-80' : 'text-[var(--text-secondary)]'}`}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSend} className="p-3 border-t border-[var(--border-dim)] bg-[var(--bg-card)] flex gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Message..."
          className="flex-1 cyber-input rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] font-medium focus:outline-none focus:ring-4 focus:ring-[rgba(0,242,254,0.1)] focus:border-[var(--accent-cyan)] transition-all"
        />
        <button
          type="submit"
          disabled={!newMessage.trim()}
          className="deploy-btn px-4 rounded-xl disabled:opacity-50 transition-colors"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
