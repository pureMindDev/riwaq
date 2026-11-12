import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import { securityHeaders } from './middleware/securityHeaders.js'
import { notFound } from './middleware/notFound.js'
import { errorHandler } from './middleware/errorHandler.js'
import { createRoutes } from './routes/index.js'

// Configures Express. It does not start listening (see server.js), so tests can use it directly.
export function createApp({ config, services }) {
  const app = express()
  app.disable('x-powered-by')
  if (config.trustProxy) app.set('trust proxy', config.trustProxy)
  app.use(cors({ origin: config.corsOrigins }))
  app.use(securityHeaders)
  app.use(express.json({ limit: '100kb' }))

  app.get('/api/health', (_req, res) => res.json({ ok: true }))
  // Tells the frontend what is genuinely available.
  app.get('/api/status', (_req, res) =>
    res.json({
      database: { connected: mongoose.connection.readyState === 1 },
      quran: { configured: services.quran.configured, environment: services.quran.environment },
      recitation: { available: services.engine.available, validated: config.recitation.validated },
      muallim: { strict: !config.muallim.allowSelfDeclaration },
    }),
  )

  app.use('/api', createRoutes(services))
  app.use('/api', notFound)
  app.use(errorHandler)
  return app
}
