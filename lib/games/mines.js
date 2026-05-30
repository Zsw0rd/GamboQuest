import { MINES_BASE_MULTIPLIER } from './constants'
import { pickUniquePositions } from './rng'
import { adjustWallet, getWalletBalance } from '../wallet'
import { createGameSession, getGameSession, updateGameSession } from './session-store'

function calcMultiplier(baseMult, revealedCount) {
  return Math.round((baseMult + 0.05 * revealedCount) * 100) / 100
}

export async function startMines(ctx, { bet, numBombs }) {
  if (!Number.isInteger(bet) || bet <= 0) throw new Error('Invalid bet amount')
  if (![3, 5, 10].includes(numBombs)) throw new Error('Invalid bomb count')

  const balance = await adjustWallet(ctx.userId, ctx.guestToken, -bet, 'mines', { action: 'bet' })
  const gridSize = 25
  const bombPositions = pickUniquePositions(numBombs, gridSize)
  const baseMult = MINES_BASE_MULTIPLIER[numBombs] || 1.0

  const state = {
    bombPositions,
    revealed: [],
    bet,
    numBombs,
    gridSize,
    baseMult,
    currentMult: baseMult,
  }

  const sessionId = await createGameSession({
    userId: ctx.userId,
    guestToken: ctx.guestToken,
    gameType: 'mines',
    betAmount: bet,
    state,
  })

  return { sessionId, balance, baseMult, gridSize }
}

export async function revealMinesCell(ctx, { sessionId, cellIndex }) {
  const session = await getGameSession(sessionId, ctx.userId, ctx.guestToken)
  const state = session.metadata?.state || session.metadata

  if (!state || typeof cellIndex !== 'number' || cellIndex < 0 || cellIndex >= state.gridSize) {
    throw new Error('Invalid cell')
  }

  if (state.revealed.includes(cellIndex)) {
    throw new Error('Cell already revealed')
  }

  const isBomb = state.bombPositions.includes(cellIndex)
  state.revealed.push(cellIndex)

  if (isBomb) {
    await updateGameSession(sessionId, { status: 'lost', payout: 0, state, settled: true })
    return {
      isBomb: true,
      gameOver: true,
      won: false,
      bombPositions: state.bombPositions,
      balance: await getWalletBalance(ctx.userId, ctx.guestToken),
    }
  }

  state.currentMult = calcMultiplier(state.baseMult, state.revealed.length)
  const safeCellsNeeded = state.gridSize - state.bombPositions.length
  const clearedAll = state.revealed.length === safeCellsNeeded

  if (clearedAll) {
    const payout = Math.floor(state.bet * state.currentMult)
    const balance = await adjustWallet(ctx.userId, ctx.guestToken, payout, 'mines', {
      action: 'win',
      sessionId,
    })
    await updateGameSession(sessionId, { status: 'won', payout, state, settled: true })
    return {
      isBomb: false,
      gameOver: true,
      won: true,
      payout,
      multiplier: state.currentMult,
      revealedCount: state.revealed.length,
      bombPositions: state.bombPositions,
      balance,
    }
  }

  await updateGameSession(sessionId, { state })

  return {
    isBomb: false,
    gameOver: false,
    multiplier: state.currentMult,
    revealedCount: state.revealed.length,
    canCashout: state.revealed.length >= 1,
    balance: await getWalletBalance(ctx.userId, ctx.guestToken),
  }
}

export async function cashoutMines(ctx, { sessionId }) {
  const session = await getGameSession(sessionId, ctx.userId, ctx.guestToken)
  const state = session.metadata?.state || session.metadata

  if (!state || state.revealed.length === 0) {
    throw new Error('Reveal at least one safe tile before cashing out')
  }

  const payout = Math.floor(state.bet * state.currentMult)
  const balance = await adjustWallet(ctx.userId, ctx.guestToken, payout, 'mines', {
    action: 'cashout',
    sessionId,
  })

  await updateGameSession(sessionId, { status: 'cashed_out', payout, state, settled: true })

  return {
    payout,
    multiplier: state.currentMult,
    bombPositions: state.bombPositions,
    balance,
    gameOver: true,
    won: true,
  }
}
