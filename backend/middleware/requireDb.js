import mongoose from 'mongoose'
import { AppError } from '../utils/AppError.js'

// Fails at once with 503 while MongoDB is disconnected. Without this, the driver makes each request wait
// ~8 seconds for a server before failing. Public Qur'an routes, /api/health and /api/status do not use it.
// (config.database.failFast is only turned off by tests that run without any database.)
export const requireDb = (config) => (_req, _res, next) =>
  config.database.failFast && mongoose.connection.readyState !== 1
    ? next(new AppError('DATABASE_UNAVAILABLE', 'The service is temporarily unavailable. Please try again in a moment.', 503, { retryAfter: 5 }))
    : next()
