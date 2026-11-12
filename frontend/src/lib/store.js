// Local, on-device storage for guest learners (browser localStorage).
//
// IMPORTANT LIMITS (also explained to the learner in Settings):
//  - Data lives only in this browser on this device. It is NOT synced.
//  - Clearing site data, private browsing, or switching device loses it.
//  - There are no accounts yet. Use "Export my data" to keep a backup.
import { toDateStr, initialSchedule, afterRevision } from './scheduler.js'
import { rangesOverlap, formatRange, validateRange } from './passages.js'

export const STORAGE_KEY = 'digital-tahfidh:v1'
const empty = () => ({
  version: 1,
  passages: [],
  sessions: [],
  lastPosition: null, // { surah, surahName, verse }
  settings: { reciterId: null, repeat: 1, autoAdvance: true },
})

const isInt = (n) => Number.isInteger(n)
const isDate = (d) => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)

// Returns an error message, or null when the backup looks safe to load.
export function validateBackup(data) {
  if (!data || data.version !== 1 || !Array.isArray(data.passages) || !Array.isArray(data.sessions)) {
    return 'This does not look like a Digital Tahfidh backup.'
  }
  const seen = []
  for (const p of data.passages) {
    const okShape = p && typeof p.id === 'string' && isInt(p.surah) && isInt(p.from) && isInt(p.to) &&
      p.surah >= 1 && p.surah <= 114 && p.from >= 1 && p.from <= p.to &&
      ['learning', 'memorised', 'needs_review'].includes(p.status)
    if (!okShape) return 'The backup contains a passage that is not valid.'
    if (p.status !== 'learning' && !(p.schedule && isDate(p.schedule.dueDate) && isInt(p.schedule.stage))) {
      return 'The backup contains a memorised passage without a valid schedule.'
    }
    if (seen.some((q) => rangesOverlap(p, q))) return 'The backup contains overlapping passages.'
    seen.push(p)
  }
  for (const s of data.sessions) {
    if (!s || typeof s.id !== 'string' || !isDate(s.date) || !['memorise', 'revise'].includes(s.type)) {
      return 'The backup contains a session that is not valid.'
    }
  }
  return null
}

const newId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

export function createStore(storage, clock = () => new Date()) {
  let storageStatus = 'ok' // 'ok' | 'unavailable' | 'save-failed' | 'recovered'
  const listeners = new Set()

  function load() {
    if (!storage) {
      storageStatus = 'unavailable'
      return empty()
    }
    let raw
    try {
      raw = storage.getItem(STORAGE_KEY)
    } catch {
      storageStatus = 'unavailable'
      return empty()
    }
    if (!raw) return empty()
    try {
      const data = JSON.parse(raw)
      if (data?.version !== 1 || !Array.isArray(data.passages) || !Array.isArray(data.sessions)) throw new Error('shape')
      return { ...empty(), ...data, settings: { ...empty().settings, ...data.settings } }
    } catch {
      // Keep the unreadable data so nothing is silently destroyed.
      try {
        storage.setItem(`${STORAGE_KEY}:unreadable-backup`, raw)
      } catch { /* ignore */ }
      storageStatus = 'recovered'
      return empty()
    }
  }

  let state = load()

  function commit(next) {
    state = next
    if (storage) {
      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(state))
        if (storageStatus === 'save-failed') storageStatus = 'ok'
      } catch {
        storageStatus = 'save-failed'
      }
    }
    listeners.forEach((l) => l())
  }

  const today = () => toDateStr(clock())
  const findPassage = (id) => state.passages.find((p) => p.id === id)
  const mapPassage = (id, fn) => state.passages.map((p) => (p.id === id ? fn(p) : p))
  const snapshot = (p) => ({ passageId: p.id, surah: p.surah, surahName: p.surahName, from: p.from, to: p.to })

  function addSession(p, type, rating = null) {
    return { id: newId(), ...snapshot(p), type, rating, date: today(), at: clock().toISOString() }
  }

  return {
    getState: () => state,
    getStorageStatus: () => storageStatus,
    subscribe(l) {
      listeners.add(l)
      return () => listeners.delete(l)
    },

    // status: 'learning' or 'memorised' (already known)
    addPassage({ surah, surahName, from, to, status }, versesCount) {
      const problem = validateRange({ surah, from, to }, versesCount)
      if (problem) return { ok: false, error: problem }
      if (!['learning', 'memorised'].includes(status)) return { ok: false, error: 'Choose a status.' }
      const clash = state.passages.find((p) => rangesOverlap(p, { surah, from, to }))
      if (clash) {
        return { ok: false, error: `This overlaps ${formatRange(clash)}, which you already recorded.`, conflictId: clash.id }
      }
      const passage = {
        id: newId(), surah, surahName, from, to, status,
        addedAt: clock().toISOString(),
        memorisedAt: status === 'memorised' ? clock().toISOString() : null,
        schedule: status === 'memorised' ? initialSchedule(today(), 0) : null,
      }
      commit({ ...state, passages: [...state.passages, passage] })
      return { ok: true, passage }
    },

    removePassage(id) {
      commit({ ...state, passages: state.passages.filter((p) => p.id !== id) })
    },

    // Learner says they finished a memorising session for this passage today.
    logMemoriseSession(id) {
      const p = findPassage(id)
      if (!p) return
      commit({ ...state, sessions: [addSession(p, 'memorise'), ...state.sessions] })
    },

    // One place to change a passage's status without creating duplicates.
    setStatus(id, status) {
      const p = findPassage(id)
      if (!p || p.status === status) return
      if (status === 'learning') return this.moveBackToLearning(id)
      if (status === 'memorised' && p.status === 'learning') return this.markMemorised(id)
      if (status === 'memorised') {
        commit({ ...state, passages: mapPassage(id, (x) => ({ ...x, status: 'memorised' })) })
        return undefined
      }
      if (status === 'needs_review') {
        if (p.status === 'learning') {
          // Needs practice implies it was memorised once: give it a schedule due today.
          commit({
            ...state,
            passages: mapPassage(id, (x) => ({ ...x, status: 'needs_review', memorisedAt: clock().toISOString(), schedule: initialSchedule(today(), 0) })),
          })
        } else this.markNeedsReview(id)
      }
      return undefined
    },

    // Where the learner stopped inside a passage, so Continue resumes there.
    setPassagePosition(id, verse) {
      const p = findPassage(id)
      if (!p || verse < p.from || verse > p.to || p.lastVerse === verse) return
      commit({ ...state, passages: mapPassage(id, (x) => ({ ...x, lastVerse: verse })) })
    },

    markMemorised(id) {
      const p = findPassage(id)
      if (!p || p.status !== 'learning') return
      commit({
        ...state,
        passages: mapPassage(id, (x) => ({
          ...x, status: 'memorised', memorisedAt: clock().toISOString(), schedule: initialSchedule(today(), 1),
        })),
        sessions: [addSession(p, 'memorise'), ...state.sessions],
      })
    },

    markNeedsReview(id) {
      const p = findPassage(id)
      if (!p || p.status === 'learning') return
      commit({
        ...state,
        passages: mapPassage(id, (x) => ({ ...x, status: 'needs_review', schedule: { ...x.schedule, dueDate: today() } })),
      })
    },

    moveBackToLearning(id) {
      commit({ ...state, passages: mapPassage(id, (x) => ({ ...x, status: 'learning', memorisedAt: null, schedule: null })) })
    },

    completeRevision(id, rating, flagForPractice = false) {
      const p = findPassage(id)
      if (!p || !p.schedule || !['easy', 'moderate', 'difficult'].includes(rating)) return null
      const schedule = afterRevision(p.schedule, rating, today())
      const needs = rating === 'difficult' || flagForPractice
      commit({
        ...state,
        passages: mapPassage(id, (x) => ({ ...x, schedule, status: needs ? 'needs_review' : 'memorised' })),
        sessions: [addSession(p, 'revise', rating), ...state.sessions],
      })
      return schedule
    },

    // Learner overrides the suggested date.
    setDueDate(id, dueDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return
      commit({ ...state, passages: mapPassage(id, (x) => (x.schedule ? { ...x, schedule: { ...x.schedule, dueDate } } : x)) })
    },

    setLastPosition(pos) {
      const cur = state.lastPosition
      if (cur && cur.surah === pos.surah && cur.verse === pos.verse) return
      commit({ ...state, lastPosition: pos })
    },

    setSettings(patch) {
      commit({ ...state, settings: { ...state.settings, ...patch } })
    },

    exportJson: () => JSON.stringify(state, null, 2),

    // Replaces ALL data with a backup made by exportJson. Validates before touching anything.
    importJson(text) {
      let data
      try {
        data = JSON.parse(text)
      } catch {
        return { ok: false, error: 'That file is not valid JSON.' }
      }
      const problem = validateBackup(data)
      if (problem) return { ok: false, error: problem }
      commit({ ...empty(), ...data, settings: { ...empty().settings, ...data.settings } })
      return { ok: true, passages: data.passages.length, sessions: data.sessions.length }
    },

    reset() {
      commit(empty())
    },
  }
}

const safeStorage = (() => {
  try {
    const s = globalThis.localStorage
    s.setItem('__probe', '1')
    s.removeItem('__probe')
    return s
  } catch {
    return null
  }
})()

export const store = createStore(safeStorage)
