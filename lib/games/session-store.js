import { createServiceClient } from '../supabase'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function validateSessionId(sessionId) {
  if (!UUID_RE.test(String(sessionId || ''))) {
    throw new Error('Invalid game session')
  }
}

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
  validateSessionId(sessionId)

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
  validateSessionId(sessionId)

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
