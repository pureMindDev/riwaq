import { AppError } from '../utils/AppError.js'
import { juzCoverage } from '../utils/juz.js'
import { label } from '../utils/passages.js'
import { Milestone } from '../models/Milestone.js'
import { Passage } from '../models/Passage.js'
import { StudyLog } from '../models/StudyLog.js'
import { DailyPlan } from '../models/DailyPlan.js'
import { todayIn } from '../utils/dates.js'

// A Juz milestone is created when a Juz has been fully memorised THROUGH THE APP.
// (Ajza' a Hafiz merely declares do not each trigger a milestone.)
// Completing it means: revise every passage of that Juz again, and rate one sample passage from
// every completed Juz (the cumulative assessment). These ratings are self-assessed.
export function createMilestoneService({ config, quran, revision }) {
  const memorisedPassages = (userId) => Passage.find({ user: userId, status: { $in: ['memorised', 'needs_review'] } }).lean()

  async function coverageFor(userId) {
    const [juzMap, passages] = await Promise.all([quran.listJuzs(), memorisedPassages(userId)])
    return juzCoverage(juzMap, passages)
  }

  // Oldest-revised passage within a Juz: the best sample for a cumulative check.
  function samplePassage(passageIds, byId) {
    return passageIds
      .map((id) => byId.get(id))
      .filter(Boolean)
      .sort((a, b) => (a.schedule?.lastRevised || '').localeCompare(b.schedule?.lastRevised || ''))[0]
  }

  async function dto(userId, m) {
    const ids = [...m.revisionTargets, ...m.assessmentItems.map((i) => i.passage)]
    const passages = await Passage.find({ _id: { $in: ids } }).lean()
    const byId = new Map(passages.map((p) => [String(p._id), p]))
    const logs = await StudyLog.find({ user: userId, type: 'revise', passage: { $in: m.revisionTargets }, createdAt: { $gte: m.createdAt } }).lean()
    const revised = new Set(logs.map((l) => String(l.passage)))
    const targets = m.revisionTargets.filter((id) => byId.has(String(id))).map((id) => ({
      passageId: String(id), label: label(byId.get(String(id))), revisedSince: revised.has(String(id)),
    }))
    const items = m.assessmentItems.filter((i) => byId.has(String(i.passage))).map((i) => ({
      id: String(i._id), juz: i.juz, passageId: String(i.passage), label: label(byId.get(String(i.passage))), done: i.done, rating: i.rating || null,
    }))
    return {
      id: String(m._id), juz: m.juz, status: m.status, createdAt: m.createdAt, completedAt: m.completedAt || null,
      targets, assessmentItems: items,
      progress: { revised: targets.filter((t) => t.revisedSince).length, revisionTotal: targets.length, assessed: items.filter((i) => i.done).length, assessmentTotal: items.length },
      selfAssessed: true,
    }
  }

  async function evaluate(userId, timezone = 'UTC') {
    const pending = await Milestone.find({ user: userId, status: 'pending' })
    for (const m of pending) {
      const d = await dto(userId, m)
      const done = d.progress.revised === d.progress.revisionTotal && d.progress.assessed === d.progress.assessmentTotal
      if (done) {
        m.status = 'completed'
        m.completedAt = new Date()
        await m.save()
        await StudyLog.create({ user: userId, type: 'milestone', date: todayIn(timezone), snapshot: { surahName: `Juz ${m.juz} milestone` } })
        await DailyPlan.updateOne(
          { user: userId, date: todayIn(timezone) },
          { $set: { 'items.$[it].status': 'completed', 'items.$[it].completedAt': new Date() } },
          { arrayFilters: [{ 'it.milestone': m._id, 'it.status': 'pending' }] },
        )
      }
    }
  }

  // Creates milestones for newly completed Ajza'. Failures (e.g. provider down) never block the caller.
  async function sync(userId) {
    try {
      const cov = await coverageFor(userId)
      const existing = new Set((await Milestone.find({ user: userId }).lean()).map((m) => m.juz))
      const passages = await memorisedPassages(userId)
      const byId = new Map(passages.map((p) => [String(p._id), p]))
      const completeJuz = cov.filter((c) => c.complete)
      const created = []
      for (const c of completeJuz) {
        if (!c.contributed || existing.has(c.juz)) continue
        const assessmentItems = completeJuz
          .map((j) => ({ j, p: samplePassage(j.passageIds, byId) }))
          .filter((x) => x.p)
          .map((x) => ({ juz: x.j.juz, passage: x.p._id }))
        created.push(await Milestone.create({ user: userId, juz: c.juz, revisionTargets: c.passageIds, assessmentItems }))
      }
      return created
    } catch (err) {
      console.error('Milestone sync skipped:', err?.code || err?.message)
      return []
    }
  }

  return {
    coverageFor, sync, evaluate,

    async list(userId, timezone) {
      await sync(userId)
      await evaluate(userId, timezone)
      const all = await Milestone.find({ user: userId }).sort({ juz: 1 })
      return Promise.all(all.map((m) => dto(userId, m)))
    },

    async get(userId, id) {
      const m = await Milestone.findOne({ _id: id, user: userId })
      if (!m) throw new AppError('NOT_FOUND', 'Milestone not found.', 404)
      return dto(userId, m)
    },

    pending: (userId) => Milestone.find({ user: userId, status: 'pending' }).sort({ juz: 1 }).lean(),

    // Rate one sample passage of the cumulative assessment. This is a normal revision session.
    async rateAssessmentItem(userId, timezone, milestoneId, itemId, input = {}) {
      const m = await Milestone.findOne({ _id: milestoneId, user: userId })
      if (!m) throw new AppError('NOT_FOUND', 'Milestone not found.', 404)
      const item = m.assessmentItems.id(itemId)
      if (!item) throw new AppError('NOT_FOUND', 'Assessment item not found.', 404)
      if (item.done) throw new AppError('ALREADY_DONE', 'This item has already been rated.', 409)
      const done = await revision.complete(userId, timezone, item.passage, input)
      // The cumulative check is passed only by a correct recitation (an 'easy' revision).
      if (done.lastRating === 'easy' || config.muallim.allowSelfDeclaration) {
        item.done = true
        item.rating = done.lastRating
        item.at = new Date()
        await m.save()
      }
      await evaluate(userId, timezone)
      return dto(userId, await Milestone.findById(m._id))
    },
  }
}
