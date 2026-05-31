import { getAuthenticatedUser, getAccessToken } from '../../lib/supabase'
import { handleGameAction } from '../../lib/games/engine'
import { rejectIfRateLimited } from '../../lib/rate-limit'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '16kb',
    },
  },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (rejectIfRateLimited(req, res, { name: 'game', limit: 120, windowMs: 60 * 1000 })) {
    return
  }

  const accessToken = getAccessToken(req)
  const { guestToken, game, action } = req.body

  if (!game || !action) {
    return res.status(400).json({ error: 'Missing game or action' })
  }

  try {
    let ctx = { userId: null, guestToken: null }

    if (accessToken) {
      const { user, error } = await getAuthenticatedUser(accessToken)
      if (error || !user) {
        return res.status(401).json({ error: 'Unauthorized' })
      }
      ctx.userId = user.id
    } else if (guestToken) {
      ctx.guestToken = guestToken
    } else {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const result = await handleGameAction(ctx, req.body)
    return res.status(200).json(result)
  } catch (err) {
    const message = err.message || 'Game error'
    const isClientError = [
      'Insufficient',
      'Invalid',
      'Unknown',
      'Place',
      'already',
      'expired',
      'not found',
      'Reveal',
      'limited',
    ].some((text) => message.includes(text))
    const status = isClientError
      ? 400
      : 500
    if (status === 500) console.error('Game API error:', message)
    return res.status(status).json({ error: message })
  }
}
