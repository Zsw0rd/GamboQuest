import { createClient } from '@supabase/supabase-js'

function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

export function createAnonClient() {
  return createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

export function createServiceClient() {
  return createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}

export async function getAuthenticatedUser(accessToken) {
  if (!accessToken) {
    return { user: null, error: 'Missing access token' }
  }

  const supabase = createAnonClient()
  const { data, error } = await supabase.auth.getUser(accessToken)

  if (error || !data.user) {
    return { user: null, error: error?.message || 'Invalid or expired session' }
  }

  return { user: data.user, error: null }
}

export async function getProfile(userId) {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, balance')
    .eq('id', userId)
    .single()

  if (error) {
    return { profile: null, error: error.message }
  }

  return { profile: data, error: null }
}

export function getAccessToken(req) {
  const authHeader = req.headers.authorization || ''
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }

  return req.body?.accessToken || req.body?.sessionToken || null
}

export function validateSignupInput(username, email, password) {
  if (!username || !email || !password) {
    return 'All fields (username, email, password) are required'
  }

  if (username.length < 2 || username.length > 32) {
    return 'Username must be between 2 and 32 characters'
  }

  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return 'Username may only contain letters, numbers, and underscores'
  }

  if (password.length < 8) {
    return 'Password must be at least 8 characters'
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return 'Invalid email address'
  }

  return null
}
