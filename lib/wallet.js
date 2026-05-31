import { createServiceClient } from './supabase'

function validateWalletMutation(userId, guestToken, amount, reason) {
  if (!userId && !guestToken) {
    throw new Error('Authentication required')
  }
  if (!Number.isSafeInteger(amount) || amount === 0) {
    throw new Error('Invalid wallet amount')
  }
  if (!reason || typeof reason !== 'string') {
    throw new Error('Invalid wallet reason')
  }
}

export async function getWalletBalance(userId, guestToken) {
  if (!userId && !guestToken) {
    throw new Error('Authentication required')
  }

  const supabase = createServiceClient()

  if (userId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('balance')
      .eq('id', userId)
      .single()
    if (error) throw new Error('Profile not found')
    return data.balance
  }

  const { data, error } = await supabase
    .from('guest_sessions')
    .select('balance')
    .eq('token', guestToken)
    .gt('expires_at', new Date().toISOString())
    .single()

  if (error) throw new Error('Guest session not found or expired')
  return data.balance
}

export async function adjustWallet(userId, guestToken, amount, reason, metadata = {}) {
  validateWalletMutation(userId, guestToken, amount, reason)

  const supabase = createServiceClient()

  if (userId) {
    const { data, error } = await supabase.rpc('adjust_balance', {
      p_user_id: userId,
      p_amount: amount,
      p_reason: reason,
      p_metadata: metadata,
    })
    if (error) throw new Error(error.message)
    return data
  }

  const { data, error } = await supabase.rpc('adjust_guest_balance', {
    p_token: guestToken,
    p_amount: amount,
    p_reason: reason,
  })
  if (error) throw new Error(error.message)
  return data
}

export async function createGuestSession() {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('guest_sessions')
    .insert({ balance: 1000 })
    .select('token, balance')
    .single()

  if (error) throw new Error('Could not create guest session')
  return data
}
