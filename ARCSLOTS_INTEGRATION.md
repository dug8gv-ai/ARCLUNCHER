# ArcSlots - Integration Guide for Main Dashboard

## 🔗 Adding ArcSlots to Your Dashboard Navigation

This guide shows how to add ArcSlots links to your existing dashboard **without modifying core feature logic**.

---

## Option 1: Add to Header Navigation

### In `src/components/Header.tsx`:

```typescript
import { Zap } from 'lucide-react';
import Link from 'next/link';

// In your header JSX, add this to your nav menu:

<Link
  href="/slots"
  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-300 hover:text-cyan-400 transition-colors"
>
  <Zap className="w-4 h-4" />
  ArcSlots
</Link>
```

---

## Option 2: Add to Dashboard Tab Navigation (Recommended)

### In `src/app/page.tsx`:

Look for where you define your view tabs (around line 70-80):

```typescript
// CURRENT CODE
const [currentView, setCurrentView] = useState<
  'launcher' | 'trade' | 'social-pay' | 'leaderboard' | 'affiliates' | 'earn' | 'wallet' | 'guide' | 'staking' | 'gigs' | 'prediction-market'
>('launcher');

// UPDATE TO:
const [currentView, setCurrentView] = useState<
  'launcher' | 'trade' | 'social-pay' | 'leaderboard' | 'affiliates' | 'earn' | 'wallet' | 'guide' | 'staking' | 'gigs' | 'prediction-market' | 'arcslots'
>('launcher');

// Update the validViews array:
const getInitialView = () => {
  if (typeof window === 'undefined') return 'launcher';
  const hash = window.location.hash.replace('#', '');
  const validViews = ['launcher','trade','social-pay','leaderboard','affiliates','earn','wallet','guide','staking','gigs','prediction-market','arcslots'];
  return validViews.includes(hash) ? hash as any : 'launcher';
};
```

Then add the ArcSlots button to your tab navigation UI:

```typescript
// Find where you render the nav buttons and add:

<button
  onClick={() => setCurrentView('arcslots')}
  className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all ${
    currentView === 'arcslots'
      ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-500/30'
      : 'text-slate-400 hover:text-cyan-400'
  }`}
>
  <Zap className="w-5 h-5" />
  ArcSlots
</button>
```

Then in your view rendering section, add:

```typescript
{currentView === 'arcslots' && (
  <div className="space-y-6">
    <p className="text-slate-400">Redirecting to ArcSlots...</p>
    {typeof window !== 'undefined' && (window.location.href = '/slots')}
  </div>
)}
```

Or better yet, use a direct Link:

```typescript
<Link
  href="/slots"
  className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white bg-cyan-600 hover:bg-cyan-500 transition-all shadow-lg shadow-cyan-500/30"
>
  <Zap className="w-5 h-5" />
  Play ArcSlots →
</Link>
```

---

## Option 3: Add a Card/Widget to Dashboard Home

### Add to `src/app/page.tsx` (Launcher view):

```typescript
{currentView === 'launcher' && (
  <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
    {/* Your existing launcher cards */}
    
    {/* New ArcSlots Card */}
    <Link href="/slots">
      <div className="p-6 rounded-xl bg-gradient-to-br from-purple-600 via-blue-600 to-cyan-500 hover:from-purple-500 hover:via-blue-500 hover:to-cyan-400 transition-all cursor-pointer shadow-xl hover:shadow-cyan-500/30">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white">ArcSlots</h3>
          <Zap className="w-6 h-6 text-white" />
        </div>
        <p className="text-sm text-white/80 mb-4">
          Spin to win ARC rewards
        </p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-white/60">3 decimals: USDC • 18 decimals: ARC</span>
          <ArrowRight className="w-4 h-4 text-white" />
        </div>
      </div>
    </Link>
  </div>
)}
```

---

## Option 4: Add Floating Action Button (FAB)

### Create `src/components/ArcSlotsFloatingButton.tsx`:

```typescript
'use client';

import Link from 'next/link';
import { Zap } from 'lucide-react';
import { motion } from 'framer-motion';

export function ArcSlotsFloatingButton() {
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      whileHover={{ scale: 1.1 }}
      className="fixed bottom-8 right-8 z-40"
    >
      <Link
        href="/slots"
        className="flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-2xl hover:shadow-cyan-500/50 transition-all"
        title="Open ArcSlots"
      >
        <Zap className="w-8 h-8" />
      </Link>
    </motion.div>
  );
}
```

Then add to `src/app/page.tsx` JSX:

```typescript
import { ArcSlotsFloatingButton } from '@/components/ArcSlotsFloatingButton';

export default function Home() {
  return (
    <div>
      {/* Your existing content */}
      <ArcSlotsFloatingButton />
    </div>
  );
}
```

---

## Option 5: Add to Sidebar/Navigation Menu

### Example sidebar button:

```typescript
<nav className="space-y-2">
  {/* Your existing nav items */}
  
  <Link
    href="/slots"
    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold text-slate-300 hover:text-white hover:bg-slate-700 transition-colors"
  >
    <Zap className="w-5 h-5 text-cyan-400" />
    <span>ArcSlots</span>
    <span className="ml-auto text-xs bg-cyan-600 text-white px-2 py-1 rounded">
      NEW
    </span>
  </Link>
</nav>
```

---

## Testing the Integration

After adding ArcSlots navigation:

1. **Link Test:**
   ```bash
   npm run dev
   # Click the ArcSlots link
   # Should navigate to http://localhost:3000/slots
   ```

2. **Navigation Test:**
   - Click link from dashboard
   - Click "Back to Dashboard" on /slots page
   - Should return to home

3. **State Preservation:**
   - Navigate to /slots
   - Spin some slots
   - Go back to dashboard
   - Navigate to /slots again
   - Previous pool state should load

---

## Icon Options

The component uses `Zap` from lucide-react. Alternative icons:

```typescript
import { Zap, Coins, Gamepad2, Trophy, Sparkles } from 'lucide-react';

// Zap     - Lightning bolt (current)
// Coins   - Money theme
// Gamepad2 - Gaming theme
// Trophy  - Win/achievement theme
// Sparkles - Magic/luck theme
```

---

## Styling Consistency

Match your existing dashboard colors:

```typescript
// Dark theme (current)
className="bg-gradient-to-r from-cyan-600 to-blue-600"

// Or adapt to your color scheme
className="bg-gradient-to-r from-purple-600 to-pink-600"
```

---

## ✅ Verification Checklist

After integration:

- [ ] Link appears in navigation
- [ ] Clicking link navigates to /slots
- [ ] /slots page loads with Web3Provider context
- [ ] Can connect wallet from /slots
- [ ] Back button returns to dashboard
- [ ] No console errors
- [ ] Dashboard features unchanged

---

## Important: DO NOT Modify

These files should remain **completely unchanged**:

```
❌ Do NOT modify:
- src/app/layout.tsx
- src/components/Web3Provider.tsx
- src/components/TradingPanel.tsx
- src/components/PredictionDashboard.tsx
- src/lib/arcDefiAbi.ts
- src/lib/predictionMarketAbi.ts
```

The ArcSlots feature is self-contained in:
```
✅ Only these files:
- src/lib/arcslots/
- src/components/arcslots/
- src/app/slots/
```

---

## Example: Minimal Integration

If you just want a simple button, add this to your dashboard:

```typescript
import Link from 'next/link';
import { Zap } from 'lucide-react';

// Somewhere in your JSX:
<Link
  href="/slots"
  className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg flex items-center gap-2 transition-colors"
>
  <Zap className="w-5 h-5" />
  Play ArcSlots
</Link>
```

That's it! The entire feature is ready to use.

---

**All integration changes are backwards compatible. No existing features are affected.** ✅
