import { CARD_RANKS, CARD_SUITS, MAX_BET_AMOUNT } from './constants'
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

const RANK_VALUES = Object.fromEntries(CARD_RANKS.map((rank, index) => [rank, index + 2]))
const HAND_NAMES = [
  'High Card',
  'One Pair',
  'Two Pair',
  'Three of a Kind',
  'Straight',
  'Flush',
  'Full House',
  'Four of a Kind',
  'Straight Flush',
]

function parseCard(card) {
  const [suit, rank] = card.split('_')
  return { suit, rank, value: RANK_VALUES[rank] }
}

function holeCardsFor(state, player) {
  return player === 'player' ? state.playerCards : state[`${player}Cards`]
}

function visibleCommunityCards(state) {
  if (state.street === 'preflop') return []
  if (state.street === 'flop') return state.commCards.slice(0, 3)
  if (state.street === 'turn') return state.commCards.slice(0, 4)
  return state.commCards
}

function getStraightHigh(values) {
  const unique = [...new Set(values)].sort((a, b) => a - b)
  if (unique.includes(14)) unique.unshift(1)

  let high = 0
  for (let i = 0; i <= unique.length - 5; i++) {
    const run = unique.slice(i, i + 5)
    if (run[4] - run[0] === 4 && new Set(run).size === 5) {
      high = Math.max(high, run[4])
    }
  }
  return high
}

function handRank(category, tiebreakers) {
  return { category, tiebreakers, name: HAND_NAMES[category] }
}

function evaluateFiveCards(cards) {
  const parsed = cards.map(parseCard)
  const values = parsed.map((card) => card.value).sort((a, b) => b - a)
  const counts = new Map()

  for (const value of values) {
    counts.set(value, (counts.get(value) || 0) + 1)
  }

  const groups = [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || b.value - a.value)

  const isFlush = parsed.every((card) => card.suit === parsed[0].suit)
  const straightHigh = getStraightHigh(values)

  if (isFlush && straightHigh) return handRank(8, [straightHigh])

  const four = groups.find((group) => group.count === 4)
  if (four) {
    return handRank(7, [four.value, ...values.filter((value) => value !== four.value)])
  }

  const trips = groups.filter((group) => group.count >= 3).sort((a, b) => b.value - a.value)
  if (trips.length > 0) {
    const pair = groups
      .filter((group) => group.value !== trips[0].value && group.count >= 2)
      .sort((a, b) => b.value - a.value)[0]
    if (pair) return handRank(6, [trips[0].value, pair.value])
  }

  if (isFlush) return handRank(5, values)
  if (straightHigh) return handRank(4, [straightHigh])

  if (trips.length > 0) {
    return handRank(3, [
      trips[0].value,
      ...values.filter((value) => value !== trips[0].value).slice(0, 2),
    ])
  }

  const pairs = groups.filter((group) => group.count === 2).sort((a, b) => b.value - a.value)
  if (pairs.length >= 2) {
    const pairValues = pairs.slice(0, 2).map((pair) => pair.value)
    const kicker = values.find((value) => !pairValues.includes(value))
    return handRank(2, [...pairValues, kicker])
  }

  if (pairs.length === 1) {
    return handRank(1, [
      pairs[0].value,
      ...values.filter((value) => value !== pairs[0].value).slice(0, 3),
    ])
  }

  return handRank(0, values)
}

function compareHandRanks(a, b) {
  if (a.category !== b.category) return a.category - b.category

  const length = Math.max(a.tiebreakers.length, b.tiebreakers.length)
  for (let i = 0; i < length; i++) {
    const av = a.tiebreakers[i] || 0
    const bv = b.tiebreakers[i] || 0
    if (av !== bv) return av - bv
  }
  return 0
}

function evaluateBestHand(cards) {
  let best = null

  for (let a = 0; a < cards.length - 4; a++) {
    for (let b = a + 1; b < cards.length - 3; b++) {
      for (let c = b + 1; c < cards.length - 2; c++) {
        for (let d = c + 1; d < cards.length - 1; d++) {
          for (let e = d + 1; e < cards.length; e++) {
            const rank = evaluateFiveCards([cards[a], cards[b], cards[c], cards[d], cards[e]])
            if (!best || compareHandRanks(rank, best) > 0) best = rank
          }
        }
      }
    }
  }

  return best
}

function evaluatePokerWinners(state, candidates) {
  const results = candidates.map((player) => ({
    player,
    rank: evaluateBestHand([...holeCardsFor(state, player), ...state.commCards]),
  }))

  const best = results.reduce((currentBest, result) => (
    compareHandRanks(result.rank, currentBest.rank) > 0 ? result : currentBest
  ))
  const winners = results
    .filter((result) => compareHandRanks(result.rank, best.rank) === 0)
    .map((result) => result.player)
  const ranks = Object.fromEntries(results.map((result) => [result.player, result.rank.name]))

  return {
    winner: winners.includes('player') ? 'player' : winners[0],
    winners,
    ranks,
    winningHand: best.rank.name,
    tie: winners.length > 1,
  }
}

function preflopStrength(cards) {
  const parsed = cards.map(parseCard)
  const values = parsed.map((card) => card.value).sort((a, b) => b - a)
  const suited = parsed[0].suit === parsed[1].suit
  const paired = values[0] === values[1]
  const connected = values[0] - values[1] <= 2

  if (paired && values[0] >= 10) return 3
  if (paired || values[0] >= 14 || (values[0] >= 12 && values[1] >= 10)) return 2
  if (suited || connected || values[0] >= 11) return 1
  return 0
}

function botHandStrength(state, bot) {
  const cards = [...holeCardsFor(state, bot), ...visibleCommunityCards(state)]
  if (cards.length < 5) return preflopStrength(holeCardsFor(state, bot))
  return evaluateBestHand(cards).category
}

function botDecision(state, bot) {
  const strength = botHandStrength(state, bot)
  const x = randomInt(100) / 100

  if (state.currentBet > 0) {
    if (strength >= 4) return 'call'
    if (strength >= 2) return x < 0.88 ? 'call' : 'fold'
    return x < 0.58 ? 'call' : 'fold'
  }

  return 'check'
}

function activePlayers(state) {
  return ['player', 'bot1', 'bot2'].filter((player) => {
    if (player === 'player') return !state.playerFolded
    return !state[`${player}Folded`]
  })
}

function runBotTurns(state, events) {
  if (state.playerFolded) return

  for (const bot of ['bot1', 'bot2']) {
    const foldedKey = `${bot}Folded`
    if (state[foldedKey]) continue

    const decision = botDecision(state, bot)
    if (decision === 'fold') {
      state[foldedKey] = true
      events.push({ actor: bot, action: 'fold' })
    } else if (state.currentBet > 0) {
      state.pot += state.currentBet
      events.push({ actor: bot, action: 'call', amount: state.currentBet })
    } else {
      events.push({ actor: bot, action: 'check' })
    }
  }
}

export async function newPokerHand(ctx, { buyIn = 50 } = {}) {
  if (!Number.isSafeInteger(buyIn) || buyIn <= 0 || buyIn > MAX_BET_AMOUNT) throw new Error('Invalid buy-in')

  const balance = await adjustWallet(ctx.userId, ctx.guestToken, -buyIn, 'poker', { action: 'ante' })

  const deck = buildDeck()
  const state = {
    deck,
    buyIn,
    pot: buyIn * 3,
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
  if (session.game_type !== 'poker') throw new Error('Invalid game session')

  const state = session.metadata?.state || session.metadata

  if (state.gameOver) throw new Error('Hand is over')

  const events = []

  if (action === 'fold') {
    state.playerFolded = true
    events.push({ actor: 'player', action: 'fold' })
  } else if (action === 'bet' || action === 'raise') {
    const betAmt = action === 'bet' ? state.minBet : Math.max(amount, state.minBet * 2)
    if (!Number.isSafeInteger(betAmt) || betAmt <= 0 || betAmt > MAX_BET_AMOUNT) throw new Error('Invalid bet')

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

  runBotTurns(state, events)

  const active = activePlayers(state)

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

    return {
      events,
      gameOver: true,
      winner,
      winners: [winner],
      payout: winner === 'player' ? potAmount : 0,
      balance,
      state: publicPokerState(state),
    }
  }

  if (action !== 'fold') {
    state.street = advanceStreet(state.street)
    state.currentBet = 0
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
  state.street = 'showdown'

  const candidates = activePlayers(state)
  const result = evaluatePokerWinners(state, candidates)
  const { winner, winners, ranks, winningHand, tie } = result
  let balance = await getWalletBalance(ctx.userId, ctx.guestToken)
  let payout = 0

  if (winners.includes('player')) {
    payout = Math.floor(state.pot / winners.length)
    balance = await adjustWallet(ctx.userId, ctx.guestToken, payout, 'poker', {
      action: tie ? 'showdown_split' : 'showdown_win',
      sessionId,
    })
    events.push({ action: 'showdown', winner: 'player', winners, amount: payout, winningHand, tie })
  } else {
    events.push({ action: 'showdown', winner, winners, winningHand, tie })
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
    winners,
    tie,
    payout,
    balance,
    winningHand,
    playerHand: ranks.player,
    revealed,
    state: publicPokerState(state),
  }
}
