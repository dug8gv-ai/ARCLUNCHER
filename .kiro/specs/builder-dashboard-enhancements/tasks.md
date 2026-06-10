# Implementation Plan: Builder Dashboard Enhancements

## Overview
Five targeted enhancements to the ArcOmni Builder Dashboard: Luxury DeFi theme CSS, Supabase timeout/persistence fix, responsive profile layout, Leaderboard gold theme, and BuilderDashboard container/header polish.

## Tasks

- [ ] 1. Apply Luxury DeFi Theme CSS in globals.css
  - Update `:root` — set `--bd-bg-primary: #0a0a0f`, `--bd-accent-gold: #f5c542`, `--bd-accent-purple: #c084fc`
  - Update `.bd-card` — set `background: rgba(255,255,255,0.04)`, `backdrop-filter: blur(16px)`, `border: 1px solid rgba(245,197,66,0.15)`, `border-radius: 1.25rem`
  - Update `.bd-btn-primary` — set `background: linear-gradient(135deg,#f5c542 0%,#e09f1e 100%)`, `color: #0a0a0f`, `box-shadow: 0 0 18px rgba(245,197,66,0.4)`
  - Update `.bd-input` base and focus state — base `background: rgba(0,0,0,0.4)`, `border: 1px solid rgba(245,197,66,0.2)`; focus `border-color: #f5c542`, `box-shadow: 0 0 10px rgba(245,197,66,0.25)`
  - Update `.bd-badge-verified` — `background: rgba(245,197,66,0.15)`, `border: 1px solid rgba(245,197,66,0.4)`, `color: #f5c542` replacing green
  - Update `stat-shimmer` keyframe — cycle from `#f5c542` through `#c084fc` back to `#f5c542` using gradient + `background-clip: text`
  - _Requirements: 4_

- [ ] 2. Fix AppRegistration — Supabase timeout guard and persistence
  - In `AppRegistration.tsx`, wrap the Supabase fetch `useEffect` in `Promise.race([fetchPromise, timeoutPromise(10_000)])` — on timeout show blank form without reading localStorage
  - Verify that after a successful Supabase response `lsSave(address, deduped)` is called with merged Supabase-authoritative data, overwriting conflicting localStorage values
  - Confirm loading skeleton covers the full registration area and is replaced atomically when fetch resolves or times out
  - _Requirements: 1_

- [ ] 3. Fix AppRegistration — responsive profile view layout
  - In the verified profile view section of `AppRegistration.tsx`, wrap the app-info block and action buttons in `flex flex-col md:flex-row gap-3 items-start md:items-center` so they stack below 768 px and sit in a horizontal row at 768 px and above
  - Confirm the edit form's Category and Contract Address fields use `grid-cols-1 sm:grid-cols-2`
  - Ensure all top-level containers have `max-w-full` or `w-full` to prevent horizontal overflow
  - _Requirements: 5_

- [ ] 4. Fix Leaderboard — RankBadge gold theme and name ellipsis
  - In `Leaderboard.tsx`, update `RankBadge` index 0 (rank 1) gradient to `linear-gradient(135deg,#f5c542 0%,#e09f1e 100%)` with `color: #0a0a0f`
  - Confirm all `app_name` text elements in main row and expanded view have `overflow: hidden; text-overflow: ellipsis; white-space: nowrap`
  - Confirm expanded stat cards use `grid-cols-1 md:grid-cols-3` and screenshot gallery uses `.bd-img-scroll`
  - _Requirements: 4, 5_

- [ ] 5. Polish BuilderDashboard container and header responsiveness
  - In `BuilderDashboard.tsx`, confirm outermost `div` uses `style={{ background: 'var(--bd-bg-primary)', color: 'var(--text-primary)' }}`
  - Replace `clamp(1.25rem, 4vw, 1.875rem)` inline font-size on `<h1>` with Tailwind classes `text-xl sm:text-3xl`
  - Update the header icon container from hardcoded blue gradient to use `var(--bd-accent-gold)` styling
  - Confirm top-section grid uses `grid-cols-1 lg:grid-cols-2` and Leaderboard spans full width below
  - _Requirements: 4, 5_

## Task Dependency Graph

```json
{
  "waves": [
    { "wave": 1, "tasks": [1] },
    { "wave": 2, "tasks": [2, 3, 4, 5] }
  ],
  "dependencies": {
    "2": [1],
    "3": [1],
    "4": [1],
    "5": [1]
  }
}
```

Tasks 2, 3, 4, and 5 all depend on Task 1 because the CSS utility class changes (`.bd-card`, `.bd-btn-primary`, `.bd-input`, `.bd-badge-verified`) must be in place before verifying that component markup renders correctly against the new theme.

## Notes
- All changes are confined to `src/app/globals.css` and the four files in `src/components/builder/`.
- No new npm packages or Supabase schema changes are required.
- The Luxury Theme applies only inside the Builder Dashboard; the rest of the app keeps its light theme because `--bd-*` properties are scoped to builder components only.
