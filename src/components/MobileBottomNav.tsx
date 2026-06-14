'use client';

import { Rocket, TrendingUp, Send, Dices, Briefcase } from 'lucide-react';

interface MobileBottomNavProps {
  currentView: string;
  onNavigate: (view: string) => void;
}

const NAV_ITEMS = [
  { id: 'launcher', label: 'Home', icon: Rocket },
  { id: 'trade', label: 'Trade', icon: TrendingUp },
  { id: 'social-pay', label: 'Pay', icon: Send },
  { id: 'slots', label: 'Slots', icon: Dices },
  { id: 'gigs', label: 'Gigs', icon: Briefcase },
];

export function MobileBottomNav({ currentView, onNavigate }: MobileBottomNavProps) {
  return (
    <nav className="pwa-bottom-nav lg:hidden safe-area-bottom">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = currentView === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={isActive ? 'active' : ''}
            aria-label={item.label}
          >
            <Icon className="nav-icon" size={20} strokeWidth={isActive ? 2.5 : 1.8} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
