'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Trophy, Star, Medal } from 'lucide-react';

interface LeaderboardApp {
  id: string;
  app_name: string;
  category: string;
  team_size: number;
  developer_wallet: string;
}

export function Leaderboard() {
  const [apps, setApps] = useState<LeaderboardApp[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      // In a full implementation, you would order by an aggregated 'volume' or 'active_users' column.
      // For now we'll just fetch verified apps and simulate a ranking based on team size or date.
      const { data, error } = await supabase
        .from('registered_apps')
        .select('id, app_name, category, team_size, developer_wallet')
        .eq('is_verified', true)
        .order('created_at', { ascending: false })
        .limit(10);

      if (!error && data) {
        setApps(data);
      }
      setIsLoading(false);
    };

    fetchLeaderboard();
  }, []);

  if (isLoading) {
    return <div className="animate-pulse h-64 bg-[#090a12] rounded-2xl border border-[var(--border-dim)]"></div>;
  }

  return (
    <div className="bg-[#0d0e1c] p-6 rounded-2xl border border-[var(--border-dim)]">
      <div className="flex items-center gap-3 mb-6">
        <Trophy className="text-yellow-400" size={24} />
        <h2 className="text-xl font-bold text-white">Ecosystem Developer Leaderboard</h2>
      </div>

      <div className="space-y-4">
        {apps.length === 0 ? (
          <p className="text-[var(--text-secondary)] text-center py-8">No verified applications yet. Be the first!</p>
        ) : (
          apps.map((app, index) => (
            <div key={app.id} className="flex items-center gap-4 p-4 bg-[#090a12] rounded-xl border border-[var(--border-dim)] hover:border-cyan-500/30 transition-colors">
              <div className="flex-shrink-0 w-8 text-center">
                {index === 0 ? <Medal className="text-yellow-400 mx-auto" size={24} /> :
                 index === 1 ? <Medal className="text-slate-300 mx-auto" size={24} /> :
                 index === 2 ? <Medal className="text-amber-600 mx-auto" size={24} /> :
                 <span className="text-[var(--text-secondary)] font-bold">#{index + 1}</span>}
              </div>
              
              <div className="flex-1">
                <h3 className="text-white font-bold">{app.app_name}</h3>
                <p className="text-xs text-[var(--text-secondary)]">{app.category} • Team: {app.team_size}</p>
              </div>

              <div className="text-right">
                <div className="text-cyan-400 text-sm font-mono">{app.developer_wallet.slice(0,6)}...{app.developer_wallet.slice(-4)}</div>
                <div className="flex items-center gap-1 text-xs text-yellow-500 justify-end mt-1">
                  <Star size={12} />
                  <span>Tier {(index < 3) ? '1' : '2'} Developer</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
