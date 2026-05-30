import {
  createAnonClient,
  createServiceClient,
  getAuthenticatedUser,
  getProfile,
  getAccessToken,
  validateSignupInput,
} from '../../lib/supabase'

function authResponse(session, profile) {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at,
    username: profile.username,
    balance: profile.balance,
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { action, username, email, password, refreshToken } = req.body
  if (!action) {
    return res.status(400).json({ error: 'Missing action parameter' })
  }

  try {
    const supabase = createAnonClient()

    if (action === 'signup') {
      const validationError = validateSignupInput(username, email, password)
      if (validationError) {
        return res.status(400).json({ error: validationError })
      }

      const service = createServiceClient()
      const { data: existingProfile } = await service
        .from('profiles')
        .select('id')
        .ilike('username', username)
        .maybeSingle()

      if (existingProfile) {
        return res.status(400).json({ error: 'Invalid signup details' })
      }

      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { username: username.trim() },
        },
      })

      if (error) {
        return res.status(400).json({ error: 'Invalid signup details' })
      }

      if (!data.session) {
        return res.status(200).json({
          message: 'Check your email to confirm your account before logging in.',
          requiresEmailConfirmation: true,
        })
      }

      const { profile, error: profileError } = await getProfile(data.user.id)
      if (profileError || !profile) {
        return res.status(500).json({ error: 'Account created but profile setup failed' })
      }

      return res.status(200).json({
        message: 'Signup successful',
        ...authResponse(data.session, profile),
      })
    }

    if (action === 'login') {
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' })
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })

      if (error || !data.session) {
        return res.status(401).json({ error: 'Invalid credentials' })
      }

      const { profile, error: profileError } = await getProfile(data.user.id)
      if (profileError || !profile) {
        return res.status(500).json({ error: 'Login succeeded but profile not found' })
      }

      return res.status(200).json({
        message: 'Login successful',
        ...authResponse(data.session, profile),
      })
    }

    if (action === 'refresh') {
      if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token is required' })
      }

      const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken })
      if (error || !data.session) {
        return res.status(401).json({ error: 'Session expired. Please log in again.' })
      }

      const { profile, error: profileError } = await getProfile(data.user.id)
      if (profileError || !profile) {
        return res.status(500).json({ error: 'Could not load profile' })
      }

      return res.status(200).json({
        message: 'Session refreshed',
        ...authResponse(data.session, profile),
      })
    }

    if (action === 'logout') {
      const accessToken = getAccessToken(req)
      if (accessToken) {
        await supabase.auth.signOut()
      }
      return res.status(200).json({ message: 'Logged out' })
    }

    return res.status(400).json({ error: 'Unknown action' })
  } catch (err) {
    console.error('Auth API error')
    return res.status(500).json({ error: 'Server error' })
  }
}
