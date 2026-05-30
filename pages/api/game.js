import { getAuthenticatedUser, getAccessToken } from '../../lib/supabase'
import { handleGameAction } from '../../lib/games/engine'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
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
    const status = message.includes('Insufficient') || message.includes('Invalid')
      ? 400
      : 500
    if (status === 500) console.error('Game API error:', message)
    return res.status(status).json({ error: message })
  }
}
