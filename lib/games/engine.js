import { spinSlots } from './slots'
import { rollDice } from './dice'
import { spinRoulette } from './roulette'
import { startMines, revealMinesCell, cashoutMines } from './mines'
import { startBlackjack, hitBlackjack, standBlackjack } from './blackjack'
import { newPokerHand, pokerAction } from './poker'

export async function handleGameAction(ctx, payload) {
  const { game, action } = payload

  switch (game) {
    case 'slots':
      if (action !== 'spin') throw new Error('Unknown slots action')
      return spinSlots(ctx, payload.bet)

    case 'dice':
      if (action !== 'roll') throw new Error('Unknown dice action')
      return rollDice(ctx, {
        bet: payload.bet,
        threshold: payload.threshold,
        rollUnder: payload.rollUnder,
      })

    case 'roulette':
      if (action !== 'spin') throw new Error('Unknown roulette action')
      return spinRoulette(ctx, payload.bets)

    case 'mines':
      if (action === 'start') {
        return startMines(ctx, { bet: payload.bet, numBombs: payload.numBombs })
      }
      if (action === 'reveal') {
        return revealMinesCell(ctx, { sessionId: payload.sessionId, cellIndex: payload.cellIndex })
      }
      if (action === 'cashout') {
        return cashoutMines(ctx, { sessionId: payload.sessionId })
      }
      throw new Error('Unknown mines action')

    case 'blackjack':
      if (action === 'start') return startBlackjack(ctx, payload.bet)
      if (action === 'hit') return hitBlackjack(ctx, { sessionId: payload.sessionId })
      if (action === 'stand') return standBlackjack(ctx, { sessionId: payload.sessionId })
      throw new Error('Unknown blackjack action')

    case 'poker':
      if (action === 'new_hand') return newPokerHand(ctx, { buyIn: payload.buyIn })
      if (action === 'action') {
        return pokerAction(ctx, {
          sessionId: payload.sessionId,
          action: payload.playerAction,
          amount: payload.amount,
        })
      }
      throw new Error('Unknown poker action')

    default:
      throw new Error('Unknown game')
  }
}
