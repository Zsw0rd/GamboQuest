import { SLOT_SYMBOLS } from './constants'
import { randomInt } from './rng'
import { adjustWallet } from '../wallet'

function calcSlotPayout(bet, reels) {
  const [a, b, c] = reels.map((i) => SLOT_SYMBOLS[i])

  if (a.name === b.name && b.name === c.name) {
    return Math.floor(bet * a.threeOfKindPayout)
  }

  if (a.name === b.name && a.twoOfKindPayout > 0) {
    return Math.floor(bet * a.twoOfKindPayout)
  }
  if (b.name === c.name && b.twoOfKindPayout > 0) {
    return Math.floor(bet * b.twoOfKindPayout)
  }
  if (a.name === c.name && a.twoOfKindPayout > 0) {
    return Math.floor(bet * a.twoOfKindPayout)
  }

  return 0
}

export async function spinSlots(ctx, bet) {
  if (!Number.isInteger(bet) || bet <= 0) {
    throw new Error('Invalid bet amount')
  }

  const balance = await adjustWallet(ctx.userId, ctx.guestToken, -bet, 'slots', { action: 'bet' })

  const reels = [
    randomInt(SLOT_SYMBOLS.length),
    randomInt(SLOT_SYMBOLS.length),
    randomInt(SLOT_SYMBOLS.length),
  ]

  const winnings = calcSlotPayout(bet, reels)
  let finalBalance = balance

  if (winnings > 0) {
    finalBalance = await adjustWallet(ctx.userId, ctx.guestToken, winnings, 'slots', {
      action: 'win',
      reels,
    })
  }

  return {
    reels,
    symbols: reels.map((i) => SLOT_SYMBOLS[i].id),
    bet,
    winnings,
    balance: finalBalance,
  }
}
