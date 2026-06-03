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
  created_at: string;
}

export function P2PChat({ targetWallet }: { targetWallet: string }) {
  const { address } = useAccount();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!address || !targetWallet) return;

    // Load initial messages
    const fetchMessages = async () => {
      const { data } = await supabase
        .from('arcpay_chats')
        .select('*')
        .or(`and(sender_wallet.eq.${address},receiver_wallet.eq.${targetWallet}),and(sender_wallet.eq.${targetWallet},receiver_wallet.eq.${address})`)
        .order('created_at', { ascending: true })
        .limit(50);
      
      if (data) setMessages(data);
      setIsLoading(false);
    };

    fetchMessages();

    // Subscribe to realtime updates
    const channel = supabase.channel(`chat_${address}_${targetWallet}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'arcpay_chats',
      }, (payload) => {
        const newMsg = payload.new as ChatMessage;
        // Verify it belongs to this conversation
        if (
          (newMsg.sender_wallet.toLowerCase() === address.toLowerCase() && newMsg.receiver_wallet.toLowerCase() === targetWallet.toLowerCase()) ||
          (newMsg.sender_wallet.toLowerCase() === targetWallet.toLowerCase() && newMsg.receiver_wallet.toLowerCase() === address.toLowerCase())
        ) {
          setMessages(prev => [...prev, newMsg]);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [address, targetWallet]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !address) return;

    const msg = newMessage.trim();
    setNewMessage('');

    // Optimistic UI could be added here
    await supabase.from('arcpay_chats').insert({
      sender_wallet: address,
      receiver_wallet: targetWallet,
      message: msg
    });
  };

  if (!address) return <div className="p-4 text-slate-500">Connect wallet to chat</div>;

  return (
    <div className="flex flex-col h-[400px] bg-[#090a12] border border-slate-800 rounded-2xl overflow-hidden">
      <div className="p-3 border-b border-slate-800 bg-[#0d0e1c]">
        <h4 className="text-sm font-bold text-white">Live Secure Chat</h4>
        <p className="text-xs text-slate-500 font-mono">{targetWallet.slice(0,6)}...{targetWallet.slice(-4)}</p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="flex justify-center h-full items-center"><Loader2 className="animate-spin text-cyan-400" /></div>
        ) : messages.length === 0 ? (
          <p className="text-xs text-slate-500 text-center my-auto">Start the conversation</p>
        ) : (
          messages.map(msg => {
            const isMe = msg.sender_wallet.toLowerCase() === address.toLowerCase();
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${isMe ? 'bg-cyan-600/20 text-cyan-100 border border-cyan-500/30 rounded-br-none' : 'bg-slate-800/50 text-slate-200 border border-slate-700/50 rounded-bl-none'}`}>
                  {msg.message}
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={handleSend} className="p-3 border-t border-slate-800 bg-[#0d0e1c] flex gap-2">
        <input 
          type="text" 
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          placeholder="Message..." 
          className="flex-1 bg-black border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:border-cyan-500 outline-none"
        />
        <button type="submit" disabled={!newMessage.trim()} className="bg-cyan-600 hover:bg-cyan-500 text-white p-2 rounded-xl disabled:opacity-50 transition-colors">
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
