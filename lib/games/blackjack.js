import { CARD_RANKS, CARD_SUITS } from './constants'
import { randomInt, shuffle } from './rng'
import { adjustWallet, getWalletBalance } from '../wallet'
import { createGameSession, getGameSession, updateGameSession } from './session-store'

function buildDeck() {
  const deck = []
  for (const suit of CARD_SUITS) {
    for (const rank of CARD_RANKS) {
      deck.push({ rank, suit })
    }
  }
  return shuffle(deck)
}

function handValue(hand) {
  let value = 0
  let aces = 0
  for (const card of hand) {
    if (['J', 'Q', 'K'].includes(card.rank)) value += 10
    else if (card.rank === 'A') { value += 11; aces++ }
    else value += parseInt(card.rank, 10)
  }
  while (value > 21 && aces > 0) { value -= 10; aces-- }
  return value
}

function drawCard(state) {
  return state.deck.pop()
}

function dealerPlay(state) {
  while (handValue(state.dealerHand) < 17) {
    state.dealerHand.push(drawCard(state))
  }
}

function settleBlackjack(ctx, sessionId, state, result) {
  let payout = 0
  if (result === 'win') payout = state.bet * 2
  else if (result === 'blackjack') payout = Math.floor(state.bet * 2.5)
  else if (result === 'tie') payout = state.bet

  return adjustWallet(ctx.userId, ctx.guestToken, payout, 'blackjack', {
    action: 'settle',
    result,
    sessionId,
  }).then(async (balance) => {
    await updateGameSession(sessionId, {
      status: result === 'lose' ? 'lost' : 'won',
      payout,
      state: { ...state, finished: true },
      settled: true,
    })
    return { result, payout, balance }
  })
}

export async function startBlackjack(ctx, bet) {
  if (!Number.isInteger(bet) || bet <= 0) throw new Error('Invalid bet amount')

  const balance = await adjustWallet(ctx.userId, ctx.guestToken, -bet, 'blackjack', { action: 'bet' })
  const deck = buildDeck()
  const state = {
    deck,
    bet,
    playerHand: [drawCard({ deck }), drawCard({ deck })],
    dealerHand: [drawCard({ deck }), drawCard({ deck })],
    finished: false,
  }

  const sessionId = await createGameSession({
    userId: ctx.userId,
    guestToken: ctx.guestToken,
    gameType: 'blackjack',
    betAmount: bet,
    state,
  })

  const playerValue = handValue(state.playerHand)
  const dealerValue = handValue(state.dealerHand)

  if (playerValue === 21) {
    const settlement = await settleBlackjack(
      ctx,
      sessionId,
      state,
      dealerValue === 21 ? 'tie' : 'blackjack'
    )
    return {
      sessionId,
      playerHand: state.playerHand,
      dealerHand: state.dealerHand,
      dealerHidden: false,
      playerValue,
      dealerValue,
      gameOver: true,
      ...settlement,
    }
  }

  return {
    sessionId,
    playerHand: state.playerHand,
    dealerHand: [state.dealerHand[0]],
    dealerHidden: true,
    playerValue,
    balance,
  }
}

export async function hitBlackjack(ctx, { sessionId }) {
  const session = await getGameSession(sessionId, ctx.userId, ctx.guestToken)
  const state = session.metadata?.state || session.metadata

  if (state.finished) throw new Error('Game already finished')

  state.playerHand.push(drawCard(state))
  const playerValue = handValue(state.playerHand)

  if (playerValue > 21) {
    const balance = await getWalletBalance(ctx.userId, ctx.guestToken)
    await updateGameSession(sessionId, { status: 'lost', payout: 0, state: { ...state, finished: true }, settled: true })
    return {
      playerHand: state.playerHand,
      playerValue,
      bust: true,
      gameOver: true,
      result: 'lose',
      payout: 0,
      balance,
    }
  }

  await updateGameSession(sessionId, { state })
  return { playerHand: state.playerHand, playerValue, bust: false, gameOver: false }
}

export async function standBlackjack(ctx, { sessionId }) {
  const session = await getGameSession(sessionId, ctx.userId, ctx.guestToken)
  const state = session.metadata?.state || session.metadata

  if (state.finished) throw new Error('Game already finished')

  dealerPlay(state)
  const playerValue = handValue(state.playerHand)
  const dealerValue = handValue(state.dealerHand)

  let result = 'tie'
  if (dealerValue > 21 || playerValue > dealerValue) result = 'win'
  else if (playerValue < dealerValue) result = 'lose'

  const settlement = await settleBlackjack(ctx, sessionId, state, result)

  return {
    playerHand: state.playerHand,
    dealerHand: state.dealerHand,
    playerValue,
    dealerValue,
    gameOver: true,
    ...settlement,
  }
}

export async function getDealerReveal(ctx, { sessionId }) {
  const session = await getGameSession(sessionId, ctx.userId, ctx.guestToken)
  const state = session.metadata?.state || session.metadata
  return {
    dealerHand: state.dealerHand,
    dealerValue: handValue(state.dealerHand),
  }
}
