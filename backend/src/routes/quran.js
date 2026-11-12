import { Router } from 'express'
import { intParam } from '../validate.js'

export function quranRoutes(quran) {
  const r = Router()
  const wrap = (fn) => (req, res, next) => fn(req, res).catch(next)

  r.get('/chapters', wrap(async (_req, res) => {
    res.json({ chapters: await quran.listChapters() })
  }))

  r.get('/chapters/:id', wrap(async (req, res) => {
    const id = intParam(req.params.id, 'Surah', { max: 114 })
    res.json({ chapter: await quran.getChapter(id) })
  }))

  r.get('/chapters/:id/verses', wrap(async (req, res) => {
    const id = intParam(req.params.id, 'Surah', { max: 114 })
    const from = intParam(req.query.from, 'from', { optional: true, max: 286 })
    const to = intParam(req.query.to, 'to', { optional: true, max: 286 })
    res.json(await quran.getVerses(id, from, to))
  }))

  r.get('/chapters/:id/audio', wrap(async (req, res) => {
    const id = intParam(req.params.id, 'Surah', { max: 114 })
    const reciter = intParam(req.query.reciter, 'reciter', { max: 100000 })
    res.json({ reciterId: reciter, audio: await quran.getChapterAudio(id, reciter) })
  }))

  r.get('/reciters', wrap(async (_req, res) => {
    res.json({ reciters: await quran.listReciters() })
  }))

  return r
}
