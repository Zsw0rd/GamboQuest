const buckets = globalThis.__gamboRateLimitBuckets || new Map()
globalThis.__gamboRateLimitBuckets = buckets

function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for']
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim()
  }
  return req.socket?.remoteAddress || 'unknown'
}

export function rateLimit(req, { name, limit, windowMs }) {
  const now = Date.now()
  const key = `${name}:${clientIp(req)}`
  const current = buckets.get(key)

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { limited: false, remaining: limit - 1, retryAfter: 0 }
  }

  current.count += 1
  const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000))
  return {
    limited: current.count > limit,
    remaining: Math.max(0, limit - current.count),
    retryAfter,
  }
}

export function rejectIfRateLimited(req, res, options) {
  const result = rateLimit(req, options)
  res.setHeader('X-RateLimit-Remaining', String(result.remaining))
  if (!result.limited) return false

  res.setHeader('Retry-After', String(result.retryAfter))
  res.status(429).json({ error: 'Too many requests. Please try again soon.' })
  return true
}
