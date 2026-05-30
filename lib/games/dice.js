import { randomRoll100 } from './rng'
import { adjustWallet } from '../wallet'

export async function rollDice(ctx, { bet, threshold, rollUnder }) {
  if (!Number.isInteger(bet) || bet <= 0) {
    throw new Error('Invalid bet amount')
  }
  if (!Number.isInteger(threshold) || threshold < 2 || threshold > 98) {
    throw new Error('Invalid threshold')
  }

  const chance = rollUnder ? threshold : 100 - threshold
  const multiplier = Math.floor((100 / chance) * 0.99 * 10000) / 10000

  const balanceAfterBet = await adjustWallet(ctx.userId, ctx.guestToken, -bet, 'dice', {
    action: 'bet',
    threshold,
    rollUnder,
  })

  const rollResult = randomRoll100()
  const won = rollUnder ? rollResult < threshold : rollResult > threshold

  let balance = balanceAfterBet
  let winnings = 0

  if (won) {
    winnings = Math.floor(bet * multiplier)
    balance = await adjustWallet(ctx.userId, ctx.guestToken, winnings, 'dice', {
      action: 'win',
      rollResult,
      threshold,
      rollUnder,
    })
  }

  return {
    rollResult: Math.round(rollResult * 100) / 100,
    threshold,
    rollUnder,
    multiplier,
    won,
    bet,
    winnings,
    profit: won ? winnings - bet : -bet,
    balance,
  }
}
