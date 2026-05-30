import { CARD_RANKS, CARD_SUITS } from './constants'
import { randomInt, shuffle } from './rng'
import { adjustWallet, getWalletBalance } from '../wallet'
import { createGameSession, getGameSession, updateGameSession } from './session-store'

function buildDeck() {
  const deck = []
  for (const suit of CARD_SUITS) {
    for (const rank of CARD_RANKS) {
      deck.push(`${suit}_${rank}`)
    }
  }
  return shuffle(deck)
}

function botDecision() {
  const x = randomInt(100) / 100
  if (x < 0.2) return 'fold'
  if (x < 0.7) return 'call'
  return 'raise'
}

export async function newPokerHand(ctx, { buyIn = 50 } = {}) {
  if (!Number.isInteger(buyIn) || buyIn <= 0) throw new Error('Invalid buy-in')

  const balance = await adjustWallet(ctx.userId, ctx.guestToken, -buyIn, 'poker', { action: 'ante' })

  const deck = buildDeck()
  const state = {
    deck,
    buyIn,
    pot: buyIn,
    playerCards: [deck.pop(), deck.pop()],
    bot1Cards: [deck.pop(), deck.pop()],
    bot2Cards: [deck.pop(), deck.pop()],
    commCards: [deck.pop(), deck.pop(), deck.pop(), deck.pop(), deck.pop()],
    playerFolded: false,
    bot1Folded: false,
    bot2Folded: false,
    gameOver: false,
    street: 'preflop',
    currentBet: 0,
    minBet: 50,
  }

  const sessionId = await createGameSession({
    userId: ctx.userId,
    guestToken: ctx.guestToken,
    gameType: 'poker',
    betAmount: buyIn,
    state,
  })

  return {
    sessionId,
    playerCards: state.playerCards,
    pot: state.pot,
    balance,
    street: state.street,
  }
}

export async function pokerAction(ctx, { sessionId, action, amount = 0 }) {
  const session = await getGameSession(sessionId, ctx.userId, ctx.guestToken)
  const state = session.metadata?.state || session.metadata

  if (state.gameOver) throw new Error('Hand is over')

  const events = []

  if (action === 'fold') {
    state.playerFolded = true
    events.push({ actor: 'player', action: 'fold' })
  } else if (action === 'bet' || action === 'raise') {
    const betAmt = action === 'bet' ? state.minBet : Math.max(amount, state.minBet)
    if (!Number.isInteger(betAmt) || betAmt <= 0) throw new Error('Invalid bet')

    const balance = await getWalletBalance(ctx.userId, ctx.guestToken)
    if (betAmt > balance) throw new Error('Insufficient funds')

    await adjustWallet(ctx.userId, ctx.guestToken, -betAmt, 'poker', { action, sessionId })
    state.pot += betAmt
    state.currentBet = betAmt
    events.push({ actor: 'player', action, amount: betAmt })
  } else if (action === 'check') {
    events.push({ actor: 'player', action: 'check' })
  } else {
    throw new Error('Unknown action')
  }

  if (!state.playerFolded) {
    for (const bot of ['bot1', 'bot2']) {
      const foldedKey = `${bot}Folded`
      if (state[foldedKey]) continue

      const decision = botDecision()
      if (decision === 'fold') {
        state[foldedKey] = true
        events.push({ actor: bot, action: 'fold' })
      } else if (decision === 'raise') {
        const raiseAmt = state.minBet
        state.pot += raiseAmt
        events.push({ actor: bot, action: 'raise', amount: raiseAmt })
      } else {
        if (state.currentBet > 0) {
          state.pot += state.currentBet
          events.push({ actor: bot, action: 'call', amount: state.currentBet })
        } else {
          events.push({ actor: bot, action: 'check' })
        }
      }
    }
  }

  const active = ['player', 'bot1', 'bot2'].filter((p) => {
    if (p === 'player') return !state.playerFolded
    return !state[`${p}Folded`]
  })

  if (active.length === 1) {
    const winner = active[0]
    const potAmount = state.pot
    let balance = await getWalletBalance(ctx.userId, ctx.guestToken)

    if (winner === 'player') {
      balance = await adjustWallet(ctx.userId, ctx.guestToken, potAmount, 'poker', {
        action: 'win',
        sessionId,
      })
      events.push({ actor: 'player', action: 'win_pot', amount: potAmount })
    }

    state.gameOver = true
    state.pot = 0
    await updateGameSession(sessionId, {
      status: winner === 'player' ? 'won' : 'lost',
      payout: winner === 'player' ? potAmount : 0,
      state,
      settled: true,
    })

    return { events, gameOver: true, winner, balance, state: publicPokerState(state) }
  }

  if (action !== 'fold') {
    state.street = advanceStreet(state.street)
    events.push({ action: 'advance_street', street: state.street })
  }

  if (state.street === 'showdown' || action === 'fold') {
    return await pokerShowdown(ctx, sessionId, state, events)
  }

  await updateGameSession(sessionId, { state })

  return {
    events,
    gameOver: false,
    pot: state.pot,
    street: state.street,
    balance: await getWalletBalance(ctx.userId, ctx.guestToken),
    state: publicPokerState(state),
  }
}

function advanceStreet(street) {
  const order = ['preflop', 'flop', 'turn', 'river', 'showdown']
  const idx = order.indexOf(street)
  return order[Math.min(idx + 1, order.length - 1)]
}

function publicPokerState(state) {
  return {
    pot: state.pot,
    street: state.street,
    playerFolded: state.playerFolded,
    bot1Folded: state.bot1Folded,
    bot2Folded: state.bot2Folded,
    commCards: state.street === 'preflop' ? [] :
      state.street === 'flop' ? state.commCards.slice(0, 3) :
      state.street === 'turn' ? state.commCards.slice(0, 4) :
      state.commCards,
    bot1Cards: state.bot1Folded ? null : ['hidden', 'hidden'],
    bot2Cards: state.bot2Folded ? null : ['hidden', 'hidden'],
  }
}

async function pokerShowdown(ctx, sessionId, state, events) {
  state.gameOver = true
  const candidates = []
  if (!state.playerFolded) candidates.push('player')
  if (!state.bot1Folded) candidates.push('bot1')
  if (!state.bot2Folded) candidates.push('bot2')

  const winner = candidates[randomInt(candidates.length)]
  let balance = await getWalletBalance(ctx.userId, ctx.guestToken)
  let payout = 0

  if (winner === 'player') {
    payout = state.pot
    balance = await adjustWallet(ctx.userId, ctx.guestToken, payout, 'poker', {
      action: 'showdown_win',
      sessionId,
    })
    events.push({ action: 'showdown', winner: 'player', amount: payout })
  } else {
    events.push({ action: 'showdown', winner })
  }

  const revealed = {
    bot1Cards: state.bot1Cards,
    bot2Cards: state.bot2Cards,
    commCards: state.commCards,
  }

  state.pot = 0
  await updateGameSession(sessionId, {
    status: winner === 'player' ? 'won' : 'lost',
    payout,
    state,
    settled: true,
  })

  return {
    events,
    gameOver: true,
    winner,
    payout,
    balance,
    revealed,
    state: publicPokerState(state),
  }
}
