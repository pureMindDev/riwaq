import { AppError } from '../utils/AppError.js'
import { afterRevision } from '../utils/scheduler.js'
import { daysBetween, isDateString, todayIn } from '../utils/dates.js'
import { enumParam } from '../utils/validate.js'
import { Passage } from '../models/Passage.js'
import { RecitationSubmission } from '../models/RecitationSubmission.js'
import { StudyLog } from '../models/StudyLog.js'
import { toPassageDto, label } from '../utils/passages.js'

const FRESH_MS = 60 * 60 * 1000 // a recitation can be used for one revision, within an hour

export function createRevisionService({ config, planItems, hooks }) {
  async function owned(userId, id) {
    const p = await Passage.findOne({ _id: id, user: userId })
    if (!p) throw new AppError('NOT_FOUND', 'Passage not found.', 404)
    return p
  }

  return {
    async overview(userId, timezone) {
      const today = todayIn(timezone)
      const passages = await Passage.find({ user: userId, status: { $in: ['memorised', 'needs_review'] } }).lean()
      const dtos = passages.map((p) => ({
        ...toPassageDto(p, today),
        daysSinceRevised: p.schedule?.lastRevised ? daysBetween(p.schedule.lastRevised, today) : null,
      }))
      const byDue = (a, b) => a.schedule.dueDate.localeCompare(b.schedule.dueDate)
      return {
        today,
        due: dtos.filter((p) => p.due.kind !== 'upcoming').sort(byDue),
        upcoming: dtos.filter((p) => p.due.kind === 'upcoming').sort(byDue),
        all: dtos,
      }
    },

    // A revision is completed by reciting the passage to the Muallim. The rating comes from how the recitation went:
    // passed -> easy, up to 2 corrections -> moderate, 3 or more -> difficult.
    async complete(userId, timezone, passageId, input = {}) {
      const p = await owned(userId, passageId)
      if (p.status === 'learning' || !p.schedule?.dueDate) {
        throw new AppError('NOT_MEMORISED', 'Only memorised passages can be revised.', 409)
      }
      let rating
      if (input.submissionId) {
        const sub = await RecitationSubmission.findOne({ _id: input.submissionId, user: userId, passage: p._id, kind: 'passage' })
        if (!sub || sub.from !== p.from || sub.to !== p.to) throw new AppError('NOT_FOUND', 'That recitation does not belong to this passage.', 404)
        if (sub.consumed) throw new AppError('ALREADY_USED', 'That recitation was already used. Recite again.', 409)
        if (Date.now() - sub.createdAt.getTime() > FRESH_MS) throw new AppError('EXPIRED', 'That recitation is too old. Recite again.', 409)
        if (sub.verdict === 'unclear') throw new AppError('UNCLEAR', 'The Muallim could not follow that recitation. Recite again.', 409)
        rating = sub.passed ? 'easy' : sub.corrections.length >= 3 ? 'difficult' : 'moderate'
        sub.consumed = true
        await sub.save()
      } else if (config.muallim.allowSelfDeclaration) {
        rating = enumParam(input.rating, 'rating', ['easy', 'moderate', 'difficult'])
      } else {
        throw new AppError('MUALLIM_REQUIRED', 'Recite this passage to the Muallim to complete the revision.', 409)
      }
      const today = todayIn(timezone)
      p.schedule = afterRevision(p.schedule, rating, today)
      p.status = rating === 'difficult' || input.flag === true ? 'needs_review' : 'memorised'
      await p.save()
      await StudyLog.create({
        user: userId, type: 'revise', passage: p._id, rating, date: today,
        snapshot: { surah: p.surah, surahName: p.surahName, from: p.from, to: p.to },
      })
      await planItems.complete(userId, today, { kind: 'revision', passage: p._id })
      await hooks.afterRevise?.(userId, timezone)
      return { ...toPassageDto(p, today), lastRating: rating }
    },

    async setDueDate(userId, timezone, passageId, dueDate) {
      if (!isDateString(dueDate)) throw new AppError('INVALID_PARAMETER', 'Enter a valid date.', 400)
      const today = todayIn(timezone)
      if (daysBetween(today, dueDate) > 366) throw new AppError('INVALID_PARAMETER', 'Choose a date within a year.', 400)
      const p = await owned(userId, passageId)
      if (!p.schedule?.dueDate) throw new AppError('NOT_MEMORISED', 'Only memorised passages have a schedule.', 409)
      p.schedule.dueDate = dueDate
      await p.save()
      return toPassageDto(p, today)
    },

    async history(userId, limit = 30) {
      const logs = await StudyLog.find({ user: userId, type: { $in: ['revise', 'milestone'] } }).sort({ createdAt: -1 }).limit(limit).lean()
      return logs.map((l) => ({ id: String(l._id), date: l.date, type: l.type, rating: l.rating || null, label: l.snapshot ? label(l.snapshot) : null }))
    },

    async recentActivity(userId, limit = 10) {
      const logs = await StudyLog.find({ user: userId }).sort({ createdAt: -1 }).limit(limit).lean()
      return logs.map((l) => ({
        id: String(l._id), date: l.date, type: l.type, rating: l.rating || null,
        label: l.snapshot ? label(l.snapshot) : l.lessonId || null,
      }))
    },
  }
}

