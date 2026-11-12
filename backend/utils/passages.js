import { dueState } from './scheduler.js'

export const label = (p) => `${p.surahName || `Surah ${p.surah}`} ${p.from === p.to ? p.from : `${p.from}–${p.to}`}`
export const verseCount = (p) => p.to - p.from + 1

export function toPassageDto(p, today) {
  const o = typeof p.toObject === 'function' ? p.toObject() : p
  return {
    id: String(o._id),
    surah: o.surah, surahName: o.surahName, from: o.from, to: o.to, verses: verseCount(o),
    status: o.status, source: o.source, evidence: o.evidence,
    memorisedAt: o.memorisedAt || null, lastVerse: o.lastVerse || null,
    schedule: o.schedule?.dueDate ? { stage: o.schedule.stage, dueDate: o.schedule.dueDate, lastRevised: o.schedule.lastRevised || null } : null,
    due: o.schedule?.dueDate && today ? dueState(o.schedule, today) : null,
    label: label(o),
  }
}
