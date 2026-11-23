import { asyncHandler } from '../utils/asyncHandler.js'
import { intParam } from '../utils/validate.js'

export const quranController = ({ quran }) => ({
  chapters: asyncHandler(async (_req, res) => res.json({ chapters: await quran.listChapters() })),
  chapter: asyncHandler(async (req, res) => res.json({ chapter: await quran.getChapter(intParam(req.params.id, 'Surah', { max: 114 })) })),
  verses: asyncHandler(async (req, res) => {
    const id = intParam(req.params.id, 'Surah', { max: 114 })
    const from = intParam(req.query.from, 'from', { optional: true, max: 286 })
    const to = intParam(req.query.to, 'to', { optional: true, max: 286 })
    res.json(await quran.getVerses(id, from, to))
  }),
  audio: asyncHandler(async (req, res) => {
    const id = intParam(req.params.id, 'Surah', { max: 114 })
    const reciter = intParam(req.query.reciter, 'reciter', { max: 1000000 })
    res.json({ reciterId: reciter, audio: await quran.getChapterAudio(id, reciter) })
  }),
  reciters: asyncHandler(async (_req, res) => res.json({ reciters: await quran.listReciters() })),
  juzs: asyncHandler(async (_req, res) => res.json({ juzs: await quran.listJuzs() })),
})
