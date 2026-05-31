import { createGuestSession } from '../../lib/wallet'
import { rejectIfRateLimited } from '../../lib/rate-limit'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '4kb',
    },
  },
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (rejectIfRateLimited(req, res, { name: 'guest', limit: 20, windowMs: 60 * 1000 })) {
    return
  }

  const { action } = req.body

  if (action !== 'create') {
    return res.status(400).json({ error: 'Unknown action' })
  }

  try {
    const session = await createGuestSession()
    return res.status(200).json({
      guestToken: session.token,
      balance: session.balance,
    })
  } catch (err) {
    console.error('Guest API error')
    return res.status(500).json({ error: 'Could not create guest session' })
  }
}
