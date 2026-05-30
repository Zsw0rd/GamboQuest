import { createServiceClient } from '../supabase'

export async function createGameSession({ userId, guestToken, gameType, betAmount, state }) {
  const supabase = createServiceClient()
  const row = {
    game_type: gameType,
    bet_amount: betAmount,
    status: 'active',
    metadata: { state },
  }

  if (userId) row.user_id = userId
  else row.guest_token = guestToken

  const { data, error } = await supabase
    .from('game_sessions')
    .insert(row)
    .select('id')
    .single()

  if (error) throw new Error('Could not create game session')
  return data.id
}

export async function getGameSession(sessionId, userId, guestToken) {
  const supabase = createServiceClient()
  let query = supabase
    .from('game_sessions')
    .select('*')
    .eq('id', sessionId)
    .eq('status', 'active')

  if (userId) query = query.eq('user_id', userId)
  else query = query.eq('guest_token', guestToken)

  const { data, error } = await query.single()
  if (error || !data) throw new Error('Game session not found')
  return data
}

export async function updateGameSession(sessionId, { status, payout, state, settled = false }) {
  const supabase = createServiceClient()
  const updates = {}
  if (state) updates.metadata = { state }
  if (status) updates.status = status
  if (typeof payout === 'number') updates.payout = payout
  if (settled) updates.settled_at = new Date().toISOString()

  const { error } = await supabase
    .from('game_sessions')
    .update(updates)
    .eq('id', sessionId)

  if (error) throw new Error('Could not update game session')
}
