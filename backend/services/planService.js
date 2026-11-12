import { AppError } from '../utils/AppError.js'
import { todayIn } from '../utils/dates.js'
import { label, verseCount } from '../utils/passages.js'
import { withLock } from '../utils/mutex.js'
import { DailyPlan } from '../models/DailyPlan.js'
import { Passage } from '../models/Passage.js'

const MAX_REVISIONS_PER_DAY = 6 // keeps a Tahfidh day achievable; the rest simply stay due
const MAX_ROTATION_ITEMS = 40

export function createPlanService({ quran, passages, milestones, foundation, student }) {
  // Next verses to learn: continue after the last assigned passage, never overlapping what exists.
  async function proposeNext(s) {
    const chapters = await quran.listChapters()
    const byId = new Map(chapters.map((c) => [c.id, c]))
    const ascending = s.tahfidhPlan.direction === 'ascending'
    const last = await Passage.findOne({ user: s.user, source: 'assigned' }).sort({ createdAt: -1 }).lean()
    let surah = last ? last.surah : s.tahfidhPlan.start.surah
    let verse = last ? last.to + 1 : s.tahfidhPlan.start.verse
    const all = await Passage.find({ user: s.user }).lean()
    for (let i = 0; i < 300; i++) {
      const ch = byId.get(surah)
      if (!ch) return null
      const mine = all.filter((p) => p.surah === surah)
      for (let moved = true; moved;) {
        moved = false
        for (const p of mine) if (verse >= p.from && verse <= p.to) { verse = p.to + 1; moved = true }
      }
      if (verse > ch.versesCount) {
        surah += ascending ? 1 : -1
        verse = 1
        if (surah < 1 || surah > 114) return null
        continue
      }
      let to = Math.min(ch.versesCount, verse + s.dailyTarget.newVerses - 1)
      const next = mine.filter((p) => p.from > verse).sort((a, b) => a.from - b.from)[0]
      if (next) to = Math.min(to, next.from - 1)
      return { surah, surahName: ch.nameSimple, from: verse, to }
    }
    return null
  }

  const revisionItem = (p) => ({ kind: 'revision', passage: p._id, label: label(p) })

  async function build(s, today) {
    const userId = s.user
    const items = []
    const warnings = []
    let message

    if (s.programme === 'foundation') {
      const lesson = await foundation.nextLesson(userId)
      if (lesson) items.push({ kind: 'foundation_lesson', lessonId: lesson.id, label: lesson.title })
      else message = 'You have completed the foundation lessons. When you feel ready, move on to Tahfidh in Settings.'
    } else if (s.programme === 'murajaah_only') {
      const memorised = await Passage.find({ user: userId, status: { $in: ['memorised', 'needs_review'] } }).lean()
      memorised.sort((a, b) => (a.schedule?.lastRevised || '').localeCompare(b.schedule?.lastRevised || '') || a.surah - b.surah || a.from - b.from)
      let verses = 0
      for (const p of memorised) {
        if (items.length >= MAX_ROTATION_ITEMS || (items.length > 0 && verses >= s.dailyTarget.revisionVerses)) break
        items.push(revisionItem(p))
        verses += verseCount(p)
      }
      if (items.length === 0) message = 'Tell us what you have memorised (Tahfidh → “Already memorised”) and your daily Muraja’ah will appear here.'
    } else {
      for (const m of await milestones.pending(userId)) {
        items.push({ kind: 'milestone', milestone: m._id, label: `Juz ${m.juz} milestone: revise and cumulative check` })
      }
      let active = await Passage.findOne({ user: userId, status: 'learning', source: 'assigned' }).sort({ createdAt: 1 })
      if (!active) {
        try {
          const next = await proposeNext(s)
          if (next) {
            try {
              active = await passages.createAssigned(userId, next)
            } catch (err) {
              if (err?.code !== 11000) throw err // another server instance assigned one first
              active = await Passage.findOne({ user: userId, status: 'learning', source: 'assigned' })
            }
          }
          else if (!(await Passage.exists({ user: userId, source: 'assigned' }))) {
            warnings.push('The Surah you chose to begin with is not available from the Qur’an provider right now. Pick another starting point in Settings.')
          } else message = 'There are no further verses to assign.'
        } catch (err) {
          if (err.code === 'PASSAGE_OVERLAP') throw err
          warnings.push('Today’s new passage could not be loaded because the Qur’an service is unavailable. Try again shortly.')
        }
      }
      if (active) items.push({ kind: 'new_memorisation', passage: active._id, label: label(active) })
      const due = await Passage.find({ user: userId, status: { $in: ['memorised', 'needs_review'] }, 'schedule.dueDate': { $lte: today } }).sort({ 'schedule.dueDate': 1 }).limit(MAX_REVISIONS_PER_DAY).lean()
      items.push(...due.map(revisionItem))
    }
    return { items, warnings, message }
  }

  const dto = (plan, extra = {}) => ({
    date: plan.date,
    programme: plan.programme,
    message: plan.message || null,
    warnings: extra.warnings || [],
    items: plan.items.map((i) => ({
      id: i._id ? String(i._id) : undefined, kind: i.kind, label: i.label, status: i.status || 'pending',
      passageId: i.passage ? String(i.passage) : null, lessonId: i.lessonId || null, milestoneId: i.milestone ? String(i.milestone) : null,
    })),
  })

  async function todayUnlocked(userId) {
      const s = await student.forUser(userId)
      if (s.programme === 'unassigned') throw new AppError('ASSESSMENT_REQUIRED', 'Complete the initial assessment first.', 409)
      const date = todayIn(s.timezone)
      const find = () => DailyPlan.findOne({ user: userId, date }).lean()

      let plan = await find()
      if (plan && plan.programme === s.programme) return dto(plan)
      if (plan) await DailyPlan.deleteOne({ user: userId, date }) // programme changed today: plan again

      let built
      try {
        built = await build(s, date)
      } catch (err) {
        const raced = err.code === 'PASSAGE_OVERLAP' && (await find())
        if (raced) return dto(raced)
        throw err
      }
      const doc = { user: userId, date, programme: s.programme, message: built.message, items: built.items }
      if (built.warnings.length) return dto(doc, { warnings: built.warnings }) // not saved: it will be rebuilt next time
      try {
        plan = (await DailyPlan.create(doc)).toObject()
      } catch (err) {
        if (err?.code === 11000) return dto(await find())
        throw err
      }
      return dto(plan)
  }
  return { today: (userId) => withLock(`plan:${userId}`, () => todayUnlocked(userId)) }
}
