import { AppError } from '../utils/AppError.js'

// Small in-memory limiter (per IP by default, or per whatever `key` returns) for sign-in / sign-up / uploads. Use a shared store if you run several servers.
export function rateLimit({ windowMs, max, key = (req) => req.ip }) {
  const hits = new Map()
  return (req, res, next) => {
    const now = Date.now()
    if (hits.size > 5000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k)
    const id = key(req)
    let h = hits.get(id)
    if (!h || h.reset < now) {
      h = { count: 0, reset: now + windowMs }
      hits.set(id, h)
    }
    h.count += 1
    if (h.count > max) {
      res.set('Retry-After', String(Math.ceil((h.reset - now) / 1000)))
      return next(new AppError('RATE_LIMITED', 'Too many attempts. Please wait a few minutes and try again.', 429))
    }
    return next()
  }
}
