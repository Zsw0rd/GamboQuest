# Gambo

Gambo is a browser-based casino game demo built with static HTML/CSS/JS, Next.js
API routes, and Supabase. The client handles presentation and animations; the
server validates sessions, bets, random outcomes, payouts, and wallet updates.

This project is for demo/entertainment use. Do not use it for real-money gaming
without legal review, compliance controls, formal audits, and a much stronger
fairness/accounting model.

## Features

- Email/password signup and login through Supabase Auth.
- Guest sessions with temporary balances.
- Server-side wallet updates using Supabase service-role API routes.
- Playable games:
  - Slots
  - Dice
  - Roulette
  - Sweep Bombs / Mines
  - Blackjack
  - Simplified Poker
- Daily authenticated-user bonus.
- In-app popup notifications instead of blocking browser alerts.
- Security headers, API body-size limits, basic rate limiting, and Supabase RLS.

## Tech Stack

- Next.js `16`
- React `19`
- Supabase JS `2`
- Supabase Postgres/Auth
- Static pages and browser scripts under `public/`

## Project Structure

```text
.
+-- lib/
|   +-- games/              # Server-side game engines
|   +-- rate-limit.js       # Basic API rate limiting helper
|   +-- supabase.js         # Supabase clients and auth helpers
|   +-- wallet.js           # Wallet balance helpers
+-- pages/api/
|   +-- auth.js             # Signup/login/refresh/logout
|   +-- balance.js          # Balance read and daily bonus
|   +-- game.js             # Game action dispatcher
|   +-- guest.js            # Guest session creation
+-- public/
|   +-- *.html              # Static screens
|   +-- gambo.css           # Shared styling
|   +-- js/                 # Browser-side game scripts
|   +-- images/             # Game art and card assets
|   +-- sfx/                # Sound effects
+-- supabase/migrations/    # Database schema and RPC functions
+-- next.config.js          # Redirects, caching, and security headers
+-- package.json
+-- agent.md
```

## Environment Variables

Create `.env` from `.env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Important:

- `SUPABASE_SERVICE_ROLE_KEY` must never be exposed to browser code.
- Keep `.env` and other real secret files out of git.

## Supabase Setup

Run the SQL migrations in order:

```text
001_initial_schema.sql
002_balance_functions.sql
003_game_sessions.sql
004_game_engine.sql
005_wallet_safety.sql
```

The migrations create:

- `profiles`
- `balance_transactions`
- `daily_bonuses`
- `guest_sessions`
- `game_sessions`
- wallet RPCs for authenticated and guest balances
- row-level security policies for authenticated user reads

## Local Development

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

The root route redirects to `public/index.html`.

## Production Build

```bash
npm run build
npm start
```

For Vercel, configure the same environment variables in the project settings.

## API Overview

All API routes accept `POST` only.

- `/api/auth`
  - `signup`
  - `login`
  - `refresh`
  - `logout`
- `/api/guest`
  - `create`
- `/api/balance`
  - `get`
  - `claim_daily_bonus`
- `/api/game`
  - `slots/spin`
  - `dice/roll`
  - `roulette/spin`
  - `mines/start`, `mines/reveal`, `mines/cashout`
  - `blackjack/start`, `blackjack/hit`, `blackjack/stand`
  - `poker/new_hand`, `poker/action`

Authenticated requests use a Bearer token. Guest game requests use a
server-created `guestToken` stored in `sessionStorage`.

## Security Notes

Current protections:

- Server-side random outcomes use Node `crypto`.
- Wallet mutations go through service-role API routes and database RPCs.
- API routes have body-size limits and basic IP throttling.
- Game sessions are owner-scoped by user id or guest token.
- Mines reveal requests require integer cell indexes.
- Roulette spots and total bet size are validated server-side.
- Browser messages use DOM text nodes instead of HTML injection.
- `npm audit` is clean with a PostCSS override for Next's transitive dependency.

Known production hardening still recommended:

- Move auth sessions from `localStorage` to secure, httpOnly cookies.
- Move remaining inline HTML event handlers into external JS and tighten CSP.
- Add provider-level rate limiting or WAF rules.
- Add formal tests for every game payout path.
- Replace simplified poker winner selection with a real hand evaluator.
- Add admin/accounting tools for wallet reconciliation.

## Maintenance

Check dependencies and audit status:

```bash
npm outdated
npm audit
```

Build before deployment:

```bash
npm run build
```

When changing database behavior, add a new migration under
`supabase/migrations/` and document any required production rollout steps.
