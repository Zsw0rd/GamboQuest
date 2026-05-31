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
- `lib/games/*.js` is the server-side game engine, RNG, hand evaluation, and
  payout logic.
- `lib/wallet.js` is the only app-level wallet mutation wrapper.
- `supabase/migrations/*.sql` defines profiles, wallet RPCs, game sessions, and
  guest balances.

## Safety Rules

- Never trust a bet, session id, cell index, or payout from the browser.
- Keep wager caps aligned with the database RPC cap. Current front-end/server
  game cap is `1000 GQC`; database per-transaction cap is `50000 GQC`.
- Do not expose `SUPABASE_SERVICE_ROLE_KEY` to the browser. It belongs in server
  runtime environment only.
- Prefer `textContent`, `replaceChildren`, and DOM node creation over HTML string
  injection.
- Keep API body limits and rate limiting on new API routes.
- Apply new Supabase changes as forward migrations instead of silently editing
  already-applied production migrations.
- After changing a game engine, smoke test the server API path with a guest
  session and run `npm run build`.

## Game Logic Notes

- Blackjack settles initial naturals immediately: player blackjack pays 2.5x,
  dealer blackjack loses unless both have blackjack, and a shared blackjack is a
  push. Dealer stands on 17. Hitting at 21 is rejected server-side.
- Poker is still a compact table flow, but showdown uses real 7-card hand
  evaluation and tie splitting. Bot behavior is intentionally simple and limited
  to check/call/fold responses that match the current UI.
- Dice calculates chance and multiplier server-side from the submitted threshold
  and roll mode; the browser display is only a preview.
- Mines stores bomb positions in the server session and reveals only through
  validated cell indexes.

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
- The games are entertainment/demo implementations, not audited real-money
  gaming engines. Any production gambling use needs legal review, formal tests,
  accounting controls, and fairness audits.
