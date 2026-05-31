# Agent Notes

This repository is a Next.js app that serves static game pages from `public/`
and server-authoritative API routes from `pages/api/`. Treat the browser code as
presentation only: balances, game outcomes, session ownership, and payouts must
stay validated on the server.

## Architecture

- `public/*.html` contains the playable screens.
- `public/js/core.js` owns auth storage, guest sessions, wallet refreshes, game
  API calls, audio helpers, and in-app popups.
- `public/js/*.js` owns per-game browser interactions and animations.
- `pages/api/*.js` exposes auth, guest-session, balance, and game endpoints.
- `lib/games/*.js` is the server-side game engine and payout logic.
- `lib/wallet.js` is the only app-level wallet mutation wrapper.
- `supabase/migrations/*.sql` defines profiles, wallet RPCs, game sessions, and
  guest balances.

## Safety Rules

- Never trust a bet, session id, cell index, or payout from the browser.
- Keep wager caps aligned with the database RPC cap. Current front-end/server
  game cap is `$1000`; database per-transaction cap is `$50000`.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` to the browser. It belongs in server
  runtime environment only.
- Prefer `textContent`, `replaceChildren`, and DOM node creation over HTML string
  injection.
- Keep API body limits and rate limiting on new API routes.
- Apply new Supabase changes as forward migrations instead of silently editing
  already-applied production migrations.

## Commands

```bash
npm install
npm run dev
npm run build
npm start
npm audit
```

## Environment

Required server/runtime variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

The first two are safe to identify the Supabase project. The service role key is
secret and bypasses row-level security.

## Known Tradeoffs

- Auth tokens are currently stored in `localStorage`. A stronger production
  design would move sessions to secure, httpOnly cookies.
- The app still uses static HTML with inline event attributes in several pages,
  which is why the CSP allows inline scripts. Moving those handlers into
  external JS would allow a stricter CSP.
- The poker game is intentionally simplified; the showdown winner is randomized
  among active players rather than evaluated with full poker hand rankings.
