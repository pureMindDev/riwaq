import { AppError } from '../utils/AppError.js'
import { addDays, isValidTimeZone, todayIn } from '../utils/dates.js'
import { enumParam, intParam } from '../utils/validate.js'
import { Student } from '../models/Student.js'
import { Passage } from '../models/Passage.js'
import { StudyLog } from '../models/StudyLog.js'
import { verseCount } from '../utils/passages.js'

export function createStudentService({ quran, milestones }) {
  async function forUser(userId) {
    const s = await Student.findOne({ user: userId })
    if (!s) throw new AppError('NOT_FOUND', 'Student profile not found.', 404)
    return s
  }

  const dto = (s) => ({
    programme: s.programme,
    timezone: s.timezone,
    dailyTarget: { newVerses: s.dailyTarget.newVerses, revisionVerses: s.dailyTarget.revisionVerses },
    tahfidhPlan: { direction: s.tahfidhPlan.direction, start: { surah: s.tahfidhPlan.start.surah, verse: s.tahfidhPlan.start.verse } },
    foundation: { completedLessons: s.foundation.completedLessons },
    onboarded: s.programme !== 'unassigned',
  })

  return {
    forUser,
    async profile(userId) {
      return dto(await forUser(userId))
    },

    async setProgramme(userId, programme) {
      enumParam(programme, 'programme', ['foundation', 'tahfidh', 'murajaah_only'])
      const s = await forUser(userId)
      s.programme = programme
      await s.save()
      return dto(s)
    },

    async updateSettings(userId, body) {
      const s = await forUser(userId)
      if (body.newVerses !== undefined) s.dailyTarget.newVerses = intParam(body.newVerses, 'newVerses', { max: 20 })
      if (body.revisionVerses !== undefined) s.dailyTarget.revisionVerses = intParam(body.revisionVerses, 'revisionVerses', { min: 10, max: 600 })
      if (body.direction !== undefined) s.tahfidhPlan.direction = enumParam(body.direction, 'direction', ['ascending', 'descending'])
      if (body.timezone !== undefined) {
        if (!isValidTimeZone(body.timezone)) throw new AppError('INVALID_PARAMETER', 'Unknown time zone.', 400)
        s.timezone = body.timezone
      }
      if (body.start !== undefined) {
        const surah = intParam(body.start?.surah, 'start.surah', { max: 114 })
        const verse = intParam(body.start?.verse ?? 1, 'start.verse', { max: 286 })
        const chapter = await quran.getChapter(surah) // validates the verse number against real data
        if (verse > chapter.versesCount) throw new AppError('INVALID_PARAMETER', `This Surah has ${chapter.versesCount} verses.`, 400)
        s.tahfidhPlan.start = { surah, verse }
      }
      await s.save()
      return dto(s)
    },

    // Real numbers from saved records only.
    async progress(userId) {
      const s = await forUser(userId)
      const today = todayIn(s.timezone)
      const passages = await Passage.find({ user: userId }).lean()
      const memorised = passages.filter((p) => p.status !== 'learning')
      const bySurah = new Map()
      for (const p of passages) {
        const row = bySurah.get(p.surah) || { surah: p.surah, surahName: p.surahName, memorisedVerses: 0, learningVerses: 0 }
        row[p.status === 'learning' ? 'learningVerses' : 'memorisedVerses'] += verseCount(p)
        bySurah.set(p.surah, row)
      }
      const since = addDays(today, -6)
      const logs = await StudyLog.find({ user: userId, date: { $gte: since } }).lean()
      const week = Array.from({ length: 7 }, (_, i) => {
        const date = addDays(today, i - 6)
        return { date, count: logs.filter((l) => l.date === date).length }
      })
      let juzCompleted = null
      try {
        juzCompleted = (await milestones.coverageFor(userId)).filter((c) => c.complete).length
      } catch { /* provider unavailable: leave unknown rather than guess */ }
      return {
        today,
        memorisedVerses: memorised.reduce((n, p) => n + verseCount(p), 0),
        memorisedPassages: memorised.length,
        learningPassages: passages.filter((p) => p.status === 'learning').length,
        needsReviewPassages: passages.filter((p) => p.status === 'needs_review').length,
        bySurah: [...bySurah.values()].sort((a, b) => a.surah - b.surah),
        week,
        juzCompleted,
      }
    },
  }
}
