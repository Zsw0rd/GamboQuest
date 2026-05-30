import { createGuestSession } from '../../lib/wallet'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
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
