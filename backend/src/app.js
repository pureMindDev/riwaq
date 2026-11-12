import express from 'express'
import cors from 'cors'
import { AppError } from './errors.js'
import { quranRoutes } from './routes/quran.js'
import { recitationRoutes } from './routes/recitation.js'

export function createApp({ config, quran, engine }) {
  const app = express()
  app.disable('x-powered-by')
  app.use(cors({ origin: config.corsOrigins }))
  app.use((_req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff')
    res.set('Cache-Control', 'no-store') // provider terms limit how long content may be stored
    next()
  })

  app.get('/api/health', (_req, res) => res.json({ ok: true }))

  // Tells the frontend what is genuinely available.
  app.get('/api/status', (_req, res) => {
    res.json({
      quran: { configured: quran.configured, environment: quran.environment },
      recitation: { available: engine.available, validated: config.recitation.validated },
    })
  })

  app.use('/api', quranRoutes(quran))
  app.use('/api', recitationRoutes({ quran, engine, config }))

  app.use('/api', (_req, _res, next) => next(new AppError('NOT_FOUND', 'Unknown API route.', 404)))

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: { code: err.code, message: err.message } })
    }
    if (err?.type === 'entity.too.large') {
      return res.status(413).json({ error: { code: 'TOO_LARGE', message: 'Recording is too large.' } })
    }
    console.error('Unexpected error:', err?.message) // never log request bodies
    res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong.' } })
  })
  return app
}
