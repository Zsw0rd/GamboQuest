import {
  createServiceClient,
  getAuthenticatedUser,
  getProfile,
  getAccessToken,
} from '../../lib/supabase'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { action, amount, reason, metadata } = req.body
  const accessToken = getAccessToken(req)

  if (!action || !accessToken) {
    return res.status(400).json({ error: 'Missing action or access token' })
  }

  try {
    const { user, error: authError } = await getAuthenticatedUser(accessToken)
    if (authError || !user) {
      return res.status(401).json({ error: authError || 'Unauthorized' })
    }

    const { profile, error: profileError } = await getProfile(user.id)
    if (profileError || !profile) {
      return res.status(404).json({ error: 'Profile not found' })
    }

    if (action === 'get') {
      return res.status(200).json({
        balance: profile.balance,
        username: profile.username,
      })
    }

    if (action === 'claim_daily_bonus') {
      const supabase = createServiceClient()
      const { data, error } = await supabase.rpc('claim_daily_bonus', {
        p_user_id: user.id,
      })

      if (error) {
        const message = error.message.includes('already claimed')
          ? 'Daily bonus already claimed today'
          : 'Could not claim daily bonus'
        return res.status(400).json({ error: message })
      }

      return res.status(200).json({ balance: data })
    }

    return res.status(400).json({ error: 'Unknown balance action' })
  } catch (err) {
    console.error('Balance API error')
    return res.status(500).json({ error: 'Server error' })
  }
}
