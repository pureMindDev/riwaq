import express, { Router } from 'express'
import { AppError } from '../errors.js'
import { intParam } from '../validate.js'
import { splitWords } from '../recitation/normalize.js'
import { alignRecitation } from '../recitation/align.js'

// Audio is held in memory only for this request. It is never written to disk
// or logged. If an engine is configured, the audio is sent to it (see docs).
export function recitationRoutes({ quran, engine, config }) {
  const r = Router()
  const body = express.raw({ type: ['audio/*', 'video/webm'], limit: '10mb' })

  r.post('/recitation/analyze', body, async (req, res, next) => {
    try {
      if (!engine.available) {
        throw new AppError('RECITATION_ENGINE_NOT_CONFIGURED', 'Recitation analysis is not available yet.', 501)
      }
      const surah = intParam(req.query.surah, 'surah', { max: 114 })
      const from = intParam(req.query.from, 'from', { max: 286 })
      const to = intParam(req.query.to, 'to', { max: 286 })
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        throw new AppError('INVALID_AUDIO', 'Send the recording as the request body.', 400)
      }
      const { verses } = await quran.getVerses(surah, from, to)
      const reference = verses.flatMap((v) =>
        splitWords(v.textUthmani).map((text) => ({ text, verseKey: v.verseKey })),
      )
      const heard = await engine.transcribe(req.body, req.get('content-type'))
      res.json({ result: alignRecitation(reference, heard, { conservative: !config.recitation.validated }) })
    } catch (err) {
      next(err)
    }
  })

  return r
}
