import { RED_NUMBERS, ROULETTE_WHEEL_ORDER } from './constants'
import { randomInt, randomIntRange } from './rng'
import { adjustWallet } from '../wallet'

function getColor(num) {
  if (num === 0) return 'green'
  return RED_NUMBERS.has(num) ? 'red' : 'black'
}

function getEvenOdd(num) {
  if (num === 0) return 'none'
  return num % 2 === 0 ? 'even' : 'odd'
}

function getRange(num) {
  if (num === 0) return 'none'
  return num >= 1 && num <= 18 ? '1-18' : '19-36'
}

function getDozen(num) {
  if (num === 0) return 'none'
  if (num <= 12) return '1st12'
  if (num <= 24) return '2nd12'
  return '3rd12'
}

function calcSpotPayout(spot, winningNum, amount) {
  if (!Number.isNaN(Number(spot))) {
    return parseInt(spot, 10) === winningNum ? amount * 36 : 0
  }

  const color = getColor(winningNum)
  const evenodd = getEvenOdd(winningNum)
  const range = getRange(winningNum)
  const dozen = getDozen(winningNum)

  switch (spot) {
    case 'red': return color === 'red' ? amount * 2 : 0
    case 'black': return color === 'black' ? amount * 2 : 0
    case 'even': return evenodd === 'even' ? amount * 2 : 0
    case 'odd': return evenodd === 'odd' ? amount * 2 : 0
    case '1-18': return range === '1-18' ? amount * 2 : 0
    case '19-36': return range === '19-36' ? amount * 2 : 0
    case '1st12': return dozen === '1st12' ? amount * 3 : 0
    case '2nd12': return dozen === '2nd12' ? amount * 3 : 0
    case '3rd12': return dozen === '3rd12' ? amount * 3 : 0
    default: return 0
  }
}

export async function spinRoulette(ctx, bets) {
  if (!bets || typeof bets !== 'object') {
    throw new Error('Invalid bets')
  }

  let totalBet = 0
  for (const amount of Object.values(bets)) {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error('Invalid bet amount')
    }
    totalBet += amount
  }

  if (totalBet <= 0) {
    throw new Error('Place at least one bet')
  }

  await adjustWallet(ctx.userId, ctx.guestToken, -totalBet, 'roulette', { action: 'bet', bets })

  const winningNum = randomInt(37)
  let totalWon = 0

  for (const [spot, amount] of Object.entries(bets)) {
    totalWon += calcSpotPayout(spot, winningNum, amount)
  }

  let balance
  if (totalWon > 0) {
    balance = await adjustWallet(ctx.userId, ctx.guestToken, totalWon, 'roulette', {
      action: 'win',
      winningNum,
    })
  } else {
    const { getWalletBalance } = await import('../wallet')
    balance = await getWalletBalance(ctx.userId, ctx.guestToken)
  }

  const wheelIndex = ROULETTE_WHEEL_ORDER.indexOf(winningNum)
  const fullSpins = randomIntRange(3, 4)
  const segmentAngle = 360 / 37
  const finalAngle = fullSpins * 360 - wheelIndex * segmentAngle

  return {
    winningNum,
    wheelIndex,
    finalAngle,
    totalBet,
    totalWon,
    netResult: totalWon - totalBet,
    balance,
  }
}
