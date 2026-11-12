import { AppError } from '../utils/AppError.js'
import { initialSchedule } from '../utils/scheduler.js'
import { todayIn } from '../utils/dates.js'
import { enumParam, intParam } from '../utils/validate.js'
import { gaps } from '../utils/juz.js'
import { toPassageDto, label } from '../utils/passages.js'
import { withLock } from '../utils/mutex.js'
import { Passage } from '../models/Passage.js'
import { StudyLog } from '../models/StudyLog.js'
import { RecitationSubmission } from '../models/RecitationSubmission.js'

const snapshot = (p) => ({ surah: p.surah, surahName: p.surahName, from: p.from, to: p.to })

export function createPassageService({ config, quran, milestones, planItems }) {
  async function owned(userId, id) {
    const p = await Passage.findOne({ _id: id, user: userId })
    if (!p) throw new AppError('NOT_FOUND', 'Passage not found.', 404)
    return p
  }

  const overlapping = (userId, surah, from, to) => Passage.findOne({ user: userId, surah, from: { $lte: to }, to: { $gte: from } })

  // The overlap check and the insert must happen together, one learner at a time.
  const create = (userId, data) =>
    withLock(`passages:${userId}`, async () => {
      const clash = await overlapping(userId, data.surah, data.from, data.to)
      if (clash) {
        const err = new AppError('PASSAGE_OVERLAP', `This overlaps ${label(clash)}, which you already recorded.`, 409)
        err.conflictId = String(clash._id)
        throw err
      }
      return Passage.create({ user: userId, ...data })
    })

  // A Hafiz/Hafidah (or anyone) says which whole Ajza' they have memorised. Self-declared, not verified.
  async function declareJuzUnlocked(userId, timezone, juzList, revisionVersesPerDay) {
    if (!Array.isArray(juzList) || juzList.length === 0 || juzList.length > 30) {
      throw new AppError('INVALID_PARAMETER', 'Choose between 1 and 30 Ajza’.', 400)
    }
    const wanted = [...new Set(juzList.map((j) => intParam(j, 'juz', { max: 30 })))].sort((a, b) => a - b)
    const [juzMap, chapters] = await Promise.all([quran.listJuzs(), quran.listChapters()])
    const names = new Map(chapters.map((c) => [c.id, c.nameSimple]))
    const chosen = wanted.map((n) => {
      const j = juzMap.find((x) => x.juz === n)
      if (!j) throw new AppError('CONTENT_UNAVAILABLE', `The provider has no data for Juz ${n}.`, 404)
      return j
    })
    const existing = await Passage.find({ user: userId }).lean()
    const today = todayIn(timezone)
    const toCreate = []
    let cumulative = 0
    for (const j of chosen) {
      for (const r of j.ranges) {
        const mine = existing.filter((p) => p.surah === r.surah)
        const blocking = mine.find((p) => p.status === 'learning' && p.from <= r.to && p.to >= r.from)
        if (blocking) {
          throw new AppError('PASSAGE_OVERLAP', `${label(blocking)} is still being learned. Finish or remove it first.`, 409)
        }
        for (const [a, b] of gaps(mine.map((p) => [p.from, p.to]), r.from, r.to)) {
          // Spread first revisions over the coming days so a large declaration is not due all at once.
          const offset = Math.floor(cumulative / (revisionVersesPerDay || 100))
          cumulative += b - a + 1
          toCreate.push({
            user: userId, surah: r.surah, surahName: names.get(r.surah), from: a, to: b, status: 'memorised', source: 'declared',
            evidence: 'declared', memorisedAt: new Date(), schedule: initialSchedule(today, offset),
          })
        }
      }
    }
    if (toCreate.length) await Passage.insertMany(toCreate)
    await milestones.sync(userId)
    return { created: toCreate.length, verses: cumulative, juz: wanted }
  }

  return {
    async list(userId, timezone) {
      const today = todayIn(timezone)
      const ps = await Passage.find({ user: userId }).sort({ surah: 1, from: 1 })
      return ps.map((p) => toPassageDto(p, today))
    },

    async get(userId, timezone, id) {
      return toPassageDto(await owned(userId, id), todayIn(timezone))
    },

    // The learner adds a passage themselves (learning now, or already memorised).
    async add(userId, timezone, body) {
      const surah = intParam(body.surah, 'surah', { max: 114 })
      const from = intParam(body.from, 'from', { max: 286 })
      const to = intParam(body.to, 'to', { max: 286 })
      const status = enumParam(body.status, 'status', ['learning', 'memorised'])
      const chapter = await quran.getChapter(surah) // real verse counts, never a guess
      if (from > to) throw new AppError('INVALID_PARAMETER', 'The first verse must not come after the last verse.', 400)
      if (to > chapter.versesCount) throw new AppError('INVALID_PARAMETER', `This Surah has ${chapter.versesCount} verses.`, 400)
      const today = todayIn(timezone)
      const p = await create(userId, {
        surah, surahName: chapter.nameSimple, from, to, status, source: 'self',
        evidence: status === 'memorised' ? 'self_declared' : 'none',
        memorisedAt: status === 'memorised' ? new Date() : undefined,
        schedule: status === 'memorised' ? initialSchedule(today, 0) : undefined,
      })
      if (status === 'memorised') await milestones.sync(userId)
      return toPassageDto(p, today)
    },

    // Used by the daily-plan generator.
    async createAssigned(userId, { surah, surahName, from, to }) {
      return create(userId, { surah, surahName, from, to, status: 'learning', source: 'assigned', evidence: 'none' })
    },

    // learning -> memorised. The learner must have recited the WHOLE passage to the Muallim and passed.
    async markMemorised(userId, timezone, id, { selfDeclared = false } = {}) {
      const p = await owned(userId, id)
      if (p.status !== 'learning') throw new AppError('INVALID_STATE', 'Only a passage being learned can be marked memorised.', 409)
      const passed = await RecitationSubmission.findOne({ user: userId, passage: p._id, from: p.from, to: p.to, passed: true })
      if (!passed && !(config.muallim.allowSelfDeclaration && selfDeclared === true)) {
        throw new AppError('MUALLIM_PASS_REQUIRED', 'Recite the whole passage to the Muallim and pass before it counts as memorised.', 409)
      }
      const today = todayIn(timezone)
      p.status = 'memorised'
      p.evidence = passed ? 'recitation_checked' : 'self_declared'
      p.memorisedAt = new Date()
      p.schedule = initialSchedule(today, 1)
      await p.save()
      await StudyLog.create({ user: userId, type: 'memorise', passage: p._id, date: today, snapshot: snapshot(p) })
      await planItems.complete(userId, today, { kind: 'new_memorisation', passage: p._id })
      await milestones.sync(userId)
      return toPassageDto(p, today)
    },

    // memorised <-> needs_review, or back to learning.
    async setStatus(userId, timezone, id, status) {
      enumParam(status, 'status', ['learning', 'memorised', 'needs_review'])
      const p = await owned(userId, id)
      const today = todayIn(timezone)
      if (status === p.status) return toPassageDto(p, today)
      if (status === 'learning') {
        p.status = 'learning'
        p.schedule = undefined
        p.memorisedAt = undefined
        p.evidence = 'none'
      } else if (p.status === 'learning') {
        throw new AppError('INVALID_STATE', 'Use “mark as memorised” for a passage you are learning.', 409)
      } else if (status === 'needs_review') {
        p.status = 'needs_review'
        p.schedule.dueDate = today
      } else {
        p.status = 'memorised'
      }
      await p.save()
      return toPassageDto(p, today)
    },

    async logSession(userId, timezone, id) {
      const p = await owned(userId, id)
      const today = todayIn(timezone)
      await StudyLog.create({ user: userId, type: 'memorise', passage: p._id, date: today, snapshot: snapshot(p) })
      return toPassageDto(p, today)
    },

    async setPosition(userId, id, verse) {
      const p = await owned(userId, id)
      const v = intParam(verse, 'verse', { min: p.from, max: p.to })
      p.lastVerse = v
      await p.save()
      return { lastVerse: v }
    },

    async remove(userId, id) {
      const p = await owned(userId, id)
      await p.deleteOne()
    },

    declareJuz: (userId, timezone, juzList, revisionVersesPerDay) =>
      withLock(`passages:${userId}`, () => declareJuzUnlocked(userId, timezone, juzList, revisionVersesPerDay)),

    async recitations(userId, id) {
      await owned(userId, id)
      const subs = await RecitationSubmission.find({ user: userId, passage: id }).sort({ createdAt: -1 }).limit(20).lean()
      return subs.map((s) => ({ id: String(s._id), at: s.createdAt, verdict: s.verdict, passed: s.passed, corrections: s.corrections.length }))
    },

    owned,
  }
}
