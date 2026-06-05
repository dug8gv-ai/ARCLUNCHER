# Requirements Document

## Introduction

This feature covers five targeted enhancements to the ArcOmni Builder Dashboard — a Next.js 16 / React 19 / Tailwind CSS 4 web application backed by Supabase and integrated with Arc Chain (chain ID 5042002) via viem and wagmi.

The current builder dashboard (`src/components/builder/`) has four components: `BuilderDashboard`, `AppRegistration`, `ContractTracker`, and `Leaderboard`. The enhancements must preserve all existing functionality while adding persistence, real on-chain stats, multi-project support, a luxury DeFi design theme, and full responsiveness.

---

## Glossary

- **Builder_Dashboard**: The composite page component (`BuilderDashboard.tsx`) that assembles all builder sub-components.
- **App_Registration**: The `AppRegistration.tsx` component that handles project registration, metadata-tag generation, verification, and profile editing.
- **Contract_Tracker**: The `ContractTracker.tsx` component that fetches and displays live on-chain statistics (transactions, wallets, volume) for registered contracts.
- **Leaderboard**: The `Leaderboard.tsx` component that lists all verified apps and their on-chain metrics.
- **Registered_App**: A row in the Supabase `registered_apps` table representing one developer project.
- **Verification_Hash**: A unique string embedded as an HTML meta tag (`arcomni-verification`) on the developer's website, used to prove ownership.
- **Arc_Chain**: The Arc testnet blockchain with chain ID 5042002.
- **PublicClient**: The viem `PublicClient` instance obtained via wagmi's `usePublicClient()` hook, used for all on-chain reads.
- **Supabase**: The PostgreSQL-backed BaaS used for all persistent storage in this project.
- **localStorage**: Browser-native key-value storage used as a client-side persistence layer.
- **Active_Project**: The Registered_App currently selected/displayed by the user in the App_Registration component.
- **Stats_Record**: An in-memory object `{ txs: number; uniqueWallets: number; volume: string }` calculated from on-chain logs for one contract.
- **Luxury_Theme**: The new premium DeFi visual design defined in this specification — gold/amber/dark palette with glass-morphism cards.
- **Breakpoint**: A Tailwind CSS responsive breakpoint (`sm` ≥ 640 px, `md` ≥ 768 px, `lg` ≥ 1024 px, `xl` ≥ 1280 px).

---

## Requirements

### Requirement 1: Project Verification Persistence

**User Story:** As a developer, I want my verified project profile to survive page reloads without re-entering data, so that I do not lose my progress and can return to the dashboard at any time.

#### Acceptance Criteria

1. WHEN a Registered_App row for the connected wallet is found in Supabase on page load, THE App_Registration SHALL restore all form fields (`appName`, `appUrl`, `description`, `category`, `teamSize`, `contractAddress`) and profile media fields (`logoUrl`, `bannerUrl`, `sampleImages`) from that row without requiring user input.

2. WHEN a Registered_App row retrieved from Supabase on page load has `is_verified = true`, THE App_Registration SHALL render the verified profile view (banner, logo, edit controls) within the same render cycle as the state update, ensuring no intermediate flash of the registration form.

3. WHEN the Supabase fetch for the connected wallet returns an HTTP error status (4xx or 5xx) OR does not resolve within 10 seconds, THE App_Registration SHALL display the blank registration form and SHALL NOT read from `localStorage` to populate form fields or set a verified state.

4. WHEN a project is successfully verified via the `/api/builder/verify` endpoint (HTTP 200 response received), THE App_Registration SHALL write the complete project record (all fields including `is_verified: true`) to `localStorage` under the key `arcomni_builder_project_{walletAddress}` before the next user interaction is processed.

5. WHEN a user edits and saves their profile via `handleSaveProfile` and the Supabase update returns successfully, THE App_Registration SHALL update the `localStorage` entry for that wallet address with the new field values in the same operation, so the cache is never ahead of or behind the database.

6. WHILE the initial Supabase fetch is in flight, THE App_Registration SHALL render a loading skeleton (animated placeholder covering the full registration area) so no form fields or profile UI is visible until the fetch resolves or times out; WHEN the fetch resolves or times out, THE skeleton SHALL be replaced immediately with the appropriate view (profile or blank form).

7. WHEN Supabase returns a successful response, THE App_Registration SHALL treat the Supabase record as the authoritative source of truth and SHALL overwrite any conflicting values previously stored in `localStorage` for that wallet address.

---

### Requirement 2: On-Chain Stats Fetching

**User Story:** As a developer, I want to see real transaction counts, active wallet counts, and trading volume for my contract, so that I can understand how my project is being used.

#### Acceptance Criteria

1. WHEN the Contract_Tracker renders AND `isCorrectNetwork` is `true` AND `publicClient` is available AND at least one verified app with a non-empty `contract_address` exists, THE Contract_Tracker SHALL fetch on-chain event logs for each such contract using `publicClient.getLogs()` with a block range spanning the last 5 000 blocks ending at the current block number.

2. WHEN logs are fetched for a contract, THE Contract_Tracker SHALL compute `txs` as the count of values in the set of unique `transactionHash` strings across all returned log entries, so that multiple logs sharing one hash are counted once.

3. WHEN logs are fetched for a contract AND the set of unique `transactionHash` values contains 500 or fewer entries, THE Contract_Tracker SHALL fetch the full transaction object for each unique hash via `publicClient.getTransaction()` and derive `uniqueWallets` as the count of distinct `from` address values; IF the set contains more than 500 entries, THE Contract_Tracker SHALL process only the 500 most-recent hashes (by log order) and annotate the display with "(sampled)".

4. WHEN logs are fetched for a contract, THE Contract_Tracker SHALL compute `volume` as the sum of the `value` field (native token amount in wei) across all transaction objects retrieved in criterion 3, formatted as a decimal string via `formatEther`, representing ARC volume.

5. WHEN the stats fetch for a contract fails for any reason (network error, RPC timeout, unsupported method, or empty response) AND a prior Stats_Record exists in memory for that contract, THE Contract_Tracker SHALL retain the prior Stats_Record and render a non-blocking warning icon (⚠) beside the affected contract row; IF no prior record exists (first load), THE Contract_Tracker SHALL display `0` for all three stats and render the warning icon.

6. WHEN a Stats_Record is successfully computed for a contract, THE Contract_Tracker SHALL write it to `localStorage` under the key `arcomni_contract_stats_{contractAddress}`; IF `localStorage` is unavailable (SecurityError or QuotaExceededError), THE Contract_Tracker SHALL silently skip the write without surfacing an error to the user.

7. THE Contract_Tracker SHALL schedule an automatic stats refresh every 60 seconds using a recurring interval; WHEN a refresh fires, THE Contract_Tracker SHALL re-execute the fetch-and-compute pipeline for all tracked contracts.

8. THE Contract_Tracker SHALL display a "Last updated: HH:MM:SS" label beside each contract row that reflects the timestamp of the most-recent successful Stats_Record computation for that contract.

9. WHEN `isCorrectNetwork` is `false` AND a Stats_Record exists in `localStorage` for a contract, THE Contract_Tracker SHALL display those cached values alongside the existing network-mismatch warning; WHEN no cached record exists, THE Contract_Tracker SHALL display `0` for all three stats.

10. THE Leaderboard SHALL apply the same fetch-and-compute pipeline (criteria 1–4) for each leaderboard entry's contract address when displaying live stats, so that leaderboard volume figures reflect actual on-chain activity rather than always showing zero.

---

### Requirement 3: Multi-Project Registration

**User Story:** As a developer, I want to register and manage multiple projects from the same wallet, so that I can track all of my deployed Arc Chain applications from a single account.

#### Acceptance Criteria

1. WHEN the App_Registration component mounts with a connected wallet, THE component SHALL query all Registered_App records whose `developer_wallet` matches the connected address (no row limit applied) and store the result as the `projects` list; IF the query fails, THE component SHALL treat `projects` as empty and surface an inline error message without crashing.

2. IF the `projects` list contains two or more entries, THE App_Registration SHALL render a project-selector control (tab bar or dropdown) above the profile area that labels each entry by its app name and indicates the Active_Project; the selector SHALL remain visible whenever `projects` has two or more entries.

3. WHEN the user activates the "Register New App" control, THE App_Registration SHALL clear the Active_Project selection and render the blank registration form while keeping all existing entries in the `projects` list unchanged.

4. WHEN the user submits the registration form for a new project, THE App_Registration SHALL create a new Registered_App record in persistent storage (insert, not update), and on success SHALL append the new record to the `projects` list; IF the insert fails, THE `projects` list SHALL remain unchanged and the component SHALL display an inline error.

5. WHEN a newly submitted project is successfully verified AND its record is successfully appended to the `projects` list, THE App_Registration SHALL set that project as the Active_Project; IF either the verification call or the append fails, THE Active_Project SHALL remain unchanged.

6. THE App_Registration SHALL display a count badge showing the total number of entries in the `projects` list in a location visible without scrolling whenever the project-selector control is rendered.

7. IF the `projects` list is empty, THE App_Registration SHALL render the registration form directly and SHALL NOT render the project-selector control or the count badge.

8. THE App_Registration SHALL enforce a maximum of 10 registered projects per wallet; WHEN the `projects` list already contains 10 entries, THE "Register New App" control SHALL be disabled and a tooltip SHALL explain the limit.

9. WHEN the connected wallet changes or disconnects, THE App_Registration SHALL reset the `projects` list to empty and clear the Active_Project selection.

---

### Requirement 4: Luxury DeFi Design Theme

**User Story:** As a user, I want the Builder Dashboard to have a premium, high-end visual aesthetic, so that the application looks professional and trustworthy.

#### Acceptance Criteria

1. THE Builder_Dashboard SHALL define a CSS custom property `--bd-bg-primary` with the value `#0a0a0f` and apply it as the background color of the outermost dashboard container element.

2. THE Builder_Dashboard SHALL define a CSS custom property `--bd-accent-gold` with the value `#f5c542` and reference it (via `var(--bd-accent-gold)`) in every style rule that sets heading color, active-state color, decorative border color, and interactive-highlight color.

3. THE Builder_Dashboard SHALL define a CSS custom property `--bd-accent-purple` with the value `#c084fc` and reference it (via `var(--bd-accent-purple)`) in every style rule that sets secondary label color and decorative-element color.

4. THE Builder_Dashboard SHALL render every card and panel container with the following computed styles: `background: rgba(255,255,255,0.04)`, `backdrop-filter: blur(16px)`, `border: 1px solid rgba(245,197,66,0.15)`, and `border-radius: 1.25rem`; these values SHALL be delivered via a shared utility class or CSS rule so they apply consistently to all cards.

5. THE Builder_Dashboard SHALL render the Register, Verify, and Save Profile buttons with a `background: linear-gradient(135deg,#f5c542 0%,#e09f1e 100%)`, `color: #0a0a0f`, and `box-shadow: 0 0 18px rgba(245,197,66,0.4)`; the same rule SHALL apply to any additional primary-action buttons added by other requirements in this document.

6. THE Builder_Dashboard SHALL render all `<input type="text">`, `<input type="url">`, `<input type="number">`, `<select>`, and `<textarea>` elements inside the dashboard with `background: rgba(0,0,0,0.4)` and `border: 1px solid rgba(245,197,66,0.2)`; WHEN any such element receives focus, THE element's border SHALL transition to `border-color: #f5c542` and its box shadow SHALL become `0 0 10px rgba(245,197,66,0.25)`.

7. THE Builder_Dashboard SHALL render the Verified badge element with `background: rgba(245,197,66,0.15)`, `border: 1px solid rgba(245,197,66,0.4)`, and `color: #f5c542`, replacing the prior green styling.

8. THE Builder_Dashboard SHALL apply a CSS keyframe animation named `stat-shimmer` with a duration of 3 seconds and `animation-iteration-count: infinite` to every element that bears the `.stat-value` class; the animation SHALL cycle the element's text fill color from `#f5c542` through `#c084fc` back to `#f5c542` using `background-clip: text` and `color: transparent` on a `background-image` gradient.

9. EVERY UI element that is visible, interactive, or data-bearing in the pre-theme render SHALL remain visible, interactive, and data-complete after the Luxury_Theme styles are applied; no element SHALL have its `display` set to `none`, `visibility` to `hidden`, `pointer-events` to `none` (unless it was already so), or its content cleared as a side-effect of theming.

10. EVERY CSS rule that uses a color value matching `--bd-bg-primary`, `--bd-accent-gold`, or `--bd-accent-purple` SHALL reference the corresponding custom property via `var()` rather than hard-coding the hex value, so that a single-property update propagates consistently.

---

### Requirement 5: Fully Responsive Layout

**User Story:** As a user on any device, I want all Builder Dashboard features to be fully visible and usable at any screen size, so that I can manage my projects from mobile, tablet, or desktop without any content being hidden or clipped.

#### Acceptance Criteria

1. THE Builder_Dashboard SHALL apply a single-column layout (App_Registration, then Contract_Tracker, then Leaderboard stacked vertically) when the viewport width is less than 1024 px, and a two-column layout (App_Registration in the left column, Contract_Tracker in the right column, Leaderboard spanning full width below) when the viewport width is 1024 px or greater.

2. THE App_Registration profile view SHALL render the app-info block and the action buttons (Edit Profile, Register New App) in a vertical stack when the viewport width is less than 768 px, and in a single horizontal row when the viewport width is 768 px or greater.

3. THE Contract_Tracker stats cards (Recent Txs, Active Wallets, Volume) SHALL be laid out with `display: flex; flex-wrap: wrap` and each card SHALL have `min-width: 90px`, so that cards reflow to additional rows rather than overflowing their container at any viewport width.

4. THE Leaderboard expanded-detail section SHALL render its stat cards in a single-column layout when the viewport width is less than 768 px, and in a three-column grid when the viewport width is 768 px or greater.

5. THE Leaderboard app-name text in each row SHALL have `overflow: hidden; text-overflow: ellipsis; white-space: nowrap` applied so that long names are truncated with an ellipsis rather than expanding the row width.

6. THE presence of Leaderboard rows with long app names SHALL NOT cause the page's horizontal scrollbar to appear; the `document.documentElement.scrollWidth` SHALL equal `document.documentElement.clientWidth` when only name-truncation overflow is present.

7. THE App_Registration edit form SHALL use a two-column grid for the Category and Contract Address fields when the viewport width is 640 px or greater, and a single-column layout when the viewport width is less than 640 px.

8. THE Builder_Dashboard page header (title and subtitle text) SHALL use `font-size: 1.875rem` (Tailwind `text-3xl`) when the viewport width is 640 px or greater, and `font-size: 1.25rem` (Tailwind `text-xl`) when the viewport width is less than 640 px, so that the header text remains fully within the viewport without wrapping to more than two lines.

9. WHEN sample screenshot images are rendered in App_Registration or the Leaderboard, THE images SHALL be placed inside a container with `overflow-x: auto; overflow-y: hidden` so that horizontal scrolling is scoped to that container and the page-level vertical scroll is unaffected.

10. EVERY element inside the Builder_Dashboard SHALL have a CSS `max-width` or `width` value that resolves to no more than 100 vw (or its containing block's width), so that the page's `document.documentElement.scrollWidth` never exceeds `document.documentElement.clientWidth` due to builder content.
