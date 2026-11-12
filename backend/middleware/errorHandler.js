import { AppError } from '../utils/AppError.js'

// MongoDB being unreachable is a temporary condition, not a bug: say so (503) instead of a generic 500.
const DB_DOWN_NAMES = new Set(['MongooseServerSelectionError', 'MongoServerSelectionError', 'MongoNetworkError', 'MongoNetworkTimeoutError', 'MongoNotConnectedError', 'MongoTopologyClosedError'])
export const isDatabaseDown = (err) =>
  DB_DOWN_NAMES.has(err?.name) || /buffering timed out|before initial connection|must be connected/i.test(err?.message || '')

// One place that turns errors into safe JSON. Internal details are never sent to the browser.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError) {
    const body = { code: err.code, message: err.message }
    if (err.conflictId) body.conflictId = err.conflictId
    if (err.retryAfter) res.set('Retry-After', String(err.retryAfter))
    return res.status(err.status).json({ error: body })
  }
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: { code: 'TOO_LARGE', message: 'That is too large to upload.' } })
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'The request body is not valid JSON.' } })
  if (err?.name === 'ValidationError' || err?.name === 'CastError') return res.status(400).json({ error: { code: 'INVALID_PARAMETER', message: 'Some of the information sent is not valid.' } })
  if (isDatabaseDown(err)) {
    console.error('Database unavailable:', err?.name)
    res.set('Retry-After', '5')
    return res.status(503).json({ error: { code: 'DATABASE_UNAVAILABLE', message: 'The service is temporarily unavailable. Please try again in a moment.' } })
  }
  console.error('Unexpected error:', err?.name, err?.message) // never log request bodies or tokens
  return res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong.' } })
}
