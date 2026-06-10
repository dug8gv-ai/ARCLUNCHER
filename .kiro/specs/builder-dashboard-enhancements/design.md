# Design Document

## Overview

This document details the technical design for the five Builder Dashboard enhancements. The codebase is a Next.js 16 / React 19 app using Tailwind CSS 4, Supabase, viem, and wagmi targeting Arc Chain (ID 5042002). All four builder components already exist in `src/components/builder/` and a comprehensive style baseline is in `src/app/globals.css`. The enhancements build directly on top of the existing code.

---

## Architecture

### Component Map

```
BuilderDashboard (orchestrator)
├── AppRegistration     (Req 1, 3, 4, 5)
├── ContractTracker     (Req 2, 4, 5)
└── Leaderboard         (Req 2, 4, 5)
```

Global styles live in `src/app/globals.css`. All builder-specific CSS custom properties, utility classes, and keyframe animations are declared there and consumed via `var()` references in component JSX.

### Data Flow

```
Supabase DB ──► AppRegistration (projects[])
                    │
                    ├─► localStorage (arcomni_v4_{wallet})
                    └─► ContractTracker / Leaderboard via CustomEvent
                              │
                     viem PublicClient
                              │
                    getLogs / getTransaction
                              │
                    localStorage (arcomni_contract_stats_{addr})
```

---

## Design Decisions

### Requirement 1 – Project Verification Persistence

**Current state**: `AppRegistration.tsx` already implements most of this: Supabase fetch on wallet connect, localStorage cache under `arcomni_v4_{addr}`, loading skeleton, and profile restore. The code uses `dedupe()` to merge Supabase-authoritative data over cached values and calls `lsSave` after every mutating operation.

**Gaps to close**:
- The 10-second Supabase timeout guard is not implemented; a `Promise.race` with a `setTimeout` rejection will enforce it.
- Supabase is already treated as authoritative (merged data overwrites cache), but the explicit overwrite of conflicting localStorage values should be verified to happen on every successful fetch path.
- The loading skeleton is already rendered (`isLoading` state + `bd-skeleton` divs), but needs to cover the full registration area until the fetch resolves or times out.

### Requirement 2 – On-Chain Stats Fetching

**Current state**: `ContractTracker.tsx` and `Leaderboard.tsx` both implement `getLogs` / `getTransaction` pipelines with 5 000-block range, 500-hash sampling, `formatEther` volume, localStorage caching, 60-second refresh intervals, and warning flags.

**Gaps to close**:
- Leaderboard's `RankBadge` component uses hardcoded blue/silver/bronze colors that don't match the Luxury Theme; rank badge colors will be updated in Req 4.
- The `"Last updated: HH:MM:SS"` label is present in ContractTracker but absent from Leaderboard — Leaderboard does not need it per requirements.
- The `(sampled)` annotation needs to appear on the ContractTracker display when `sampled=true` (already implemented).

### Requirement 3 – Multi-Project Registration

**Current state**: `AppRegistration.tsx` already stores all projects in `projects[]`, renders a dropdown selector when `projects.length >= 2`, enforces `MAX_PROJECTS = 10`, supports "Register New App" / cancel flow, and resets on wallet change.

**Gaps to close**:
- The count badge is already shown (`{projectCount} / {MAX_PROJECTS} projects`), visible in the header row.
- Inline error display for failed insert is handled via `toast.error`; requirements allow this pattern.
- The project selector dropdown uses a white background (`bg-[rgba(248,250,252,0.95)]`) that will be updated by Req 4 theming.

### Requirement 4 – Luxury DeFi Design Theme

**Current state**: `globals.css` defines `--bd-bg-primary`, `--bd-accent-gold`, and `--bd-accent-purple`, but maps them to the light theme blue palette (`#3b82f6`, `#8b5cf6`) instead of the required gold/purple DeFi values. The `bd-card`, `bd-btn-primary`, `bd-input`, `bd-badge-verified`, and `stat-value` classes exist but use blue-theme values.

**Design**: Update `globals.css` CSS custom properties and utility class bodies to the Luxury Theme spec. A scoped `:root` override block under a `.builder-dashboard-theme` wrapper is not needed because `BuilderDashboard` already uses `var(--bd-*)` properties that are currently aliased to blue; updating the properties globally is sufficient since no other component uses `--bd-*` variables.

**Key changes in `globals.css`**:
- `--bd-bg-primary`: `#0a0a0f`
- `--bd-accent-gold`: `#f5c542`
- `--bd-accent-purple`: `#c084fc`
- `.bd-card`: glass-morphism — `background: rgba(255,255,255,0.04)`, `backdrop-filter: blur(16px)`, `border: 1px solid rgba(245,197,66,0.15)`, `border-radius: 1.25rem`
- `.bd-btn-primary`: gold gradient, dark text, gold glow
- `.bd-input` focus: gold border + glow
- `.bd-badge-verified`: gold tones replacing green
- `stat-shimmer` keyframe: gold → purple → gold cycle
- `BuilderDashboard` outermost `div` gets `--bd-bg-primary` as background

**Important**: `globals.css` has a blanket override section (`[class*="bg-[rgba(6"]`, `.bg-\[\#0a0a0f\]`, etc.) that resets dark hex backgrounds to white. The `BuilderDashboard` wrapper must use `style={{ background: 'var(--bd-bg-primary)' }}` (inline) to survive these overrides, which it already does.

**Visibility preservation**: All interactive elements remain visible. The glass-morphism `rgba(255,255,255,0.04)` cards will sit on the dark `#0a0a0f` background, providing sufficient contrast. Text colors stay `text-white` / `var(--bd-accent-gold)` / `var(--bd-accent-purple)` as they are today.

### Requirement 5 – Fully Responsive Layout

**Current state**:
- `BuilderDashboard` already uses `grid-cols-1 lg:grid-cols-2` for the top section and full-width `Leaderboard`.
- `ContractTracker` stats cards already use `flex flex-wrap` with `minWidth: 90px`.
- Leaderboard expanded stat cards already use `grid-cols-1 md:grid-cols-3`.
- `BuilderDashboard` header uses `clamp(1.25rem, 4vw, 1.875rem)` for font-size.
- `.bd-img-scroll` already scopes horizontal scroll.

**Gaps to close**:
- `AppRegistration` profile view app-info block / action buttons need explicit `flex-col` < 768 px and `flex-row` ≥ 768 px.
- Leaderboard app-name text needs `overflow-hidden text-ellipsis whitespace-nowrap` (already present as inline style, confirm it's consistent).
- Edit form `Category` + `Contract Address` grid already has `grid-cols-1 sm:grid-cols-2`.
- Page-level horizontal scroll guard: `#__next` already has `max-width: 100vw; overflow-x: hidden` in globals.css.
- All dashboard elements need explicit `max-width: 100%` or Tailwind `w-full` to prevent overflow.

---

## Component-Level Changes

### `src/app/globals.css`

1. Update `:root` — `--bd-bg-primary`, `--bd-accent-gold`, `--bd-accent-purple` to luxury values.
2. Update `.bd-card` — glass-morphism background, gold border, backdrop-filter.
3. Update `.bd-btn-primary` — gold gradient, `#0a0a0f` text, gold box-shadow.
4. Update `.bd-input` focus state — gold border + glow.
5. Update `.bd-badge-verified` — gold tones.
6. Update `stat-shimmer` keyframe — gold → purple → gold with `background-clip: text`.
7. Add `.bd-bg-primary-bg` utility (or use inline style in component — inline is already used).

### `src/components/builder/BuilderDashboard.tsx`

1. Set outermost `div` background to `var(--bd-bg-primary)` (already done via inline style — verify and keep).
2. Header font-size responsive: `text-xl` base, `sm:text-3xl` (currently using `clamp()` — replace with Tailwind responsive classes to match spec precisely, or keep clamp as it satisfies the spec).
3. No layout change needed for the two-column grid (already `grid-cols-1 lg:grid-cols-2`).

### `src/components/builder/AppRegistration.tsx`

1. **Timeout guard**: Wrap the Supabase fetch in `Promise.race([fetchPromise, timeoutPromise(10_000)])`. On timeout, show blank form without reading localStorage.
2. **Profile view responsive layout**: Wrap the app-info + action buttons section in `flex flex-col md:flex-row gap-3 items-start md:items-center`.
3. **Edit form responsive**: `Category` and `Contract Address` already in `grid-cols-1 sm:grid-cols-2` — confirm and keep.
4. **Max-width guard**: Ensure all top-level containers have `max-w-full` or `w-full`.

### `src/components/builder/ContractTracker.tsx`

1. No changes needed beyond what globals.css provides — stats cards already use `flex flex-wrap gap-3` with `minWidth: '90px'`.
2. The "Last updated" label already exists.
3. Verify warning icon is `⚠` or `AlertTriangle` icon (already implemented with `AlertTriangle`).

### `src/components/builder/Leaderboard.tsx`

1. **App-name ellipsis**: Confirm `overflow-hidden text-ellipsis whitespace-nowrap` is present on all name elements (it is on the main row; verify expanded view heading).
2. **Responsive stat cards**: Already `grid-cols-1 md:grid-cols-3`.
3. **RankBadge**: Update first-place color to use `var(--bd-accent-gold)` gradient instead of blue, keeping silver/bronze as-is (bronze already matches luxury amber tones).
4. **Screenshot container**: Confirm uses `.bd-img-scroll` (already does).

---

## CSS Custom Property Reference

| Property | Value | Usage |
|---|---|---|
| `--bd-bg-primary` | `#0a0a0f` | Dashboard container background |
| `--bd-accent-gold` | `#f5c542` | Headings, active states, decorative borders, highlights |
| `--bd-accent-purple` | `#c084fc` | Secondary labels, decorative elements |

All color rules inside builder components that match these three values MUST use `var(--bd-accent-gold)`, `var(--bd-accent-purple)`, or `var(--bd-bg-primary)` — no hard-coded hex duplicates inside component `style={}` props for these three values.

---

## Responsive Breakpoint Summary

| Breakpoint | Layout |
|---|---|
| `< 640 px` | Single-col form fields, header `text-xl` |
| `≥ 640 px` | Two-col edit form (category + contract), header `text-3xl` |
| `< 768 px` | Profile view stacked vertically, leaderboard expanded stats single-col |
| `≥ 768 px` | Profile view horizontal row, leaderboard expanded stats 3-col grid |
| `< 1024 px` | Top grid single column |
| `≥ 1024 px` | Top grid two columns |

---

## Non-Goals

- No new API routes; the existing `/api/builder/verify` endpoint is unchanged.
- No Supabase schema changes; all existing columns are sufficient.
- No new npm dependencies; viem, wagmi, and supabase-js are already installed.
- No dark/light theme toggle; the Luxury Theme is applied unconditionally inside the Builder Dashboard section while the rest of the app keeps the light theme.
