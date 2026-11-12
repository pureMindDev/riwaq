// A deliberately simple revision schedule. It SUGGESTS when to revise next.
// It does not guarantee retention, and the learner can change any date.
//
// Rule: each passage sits on a ladder of gaps (in days).
//   easy      -> move one step up the ladder (longer gap)
//   moderate  -> stay on the same step
//   difficult -> back to the start (revise again tomorrow)
export const INTERVALS = [1, 3, 7, 14, 30, 60]

const pad = (n) => String(n).padStart(2, '0')

// Local calendar date as YYYY-MM-DD.
export function toDateStr(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function parse(str) {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(dateStr, n) {
  const d = parse(dateStr)
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}

// Whole days from `from` to `to` (positive if `to` is later).
export function daysBetween(from, to) {
  return Math.round((parse(to) - parse(from)) / 86400000)
}

export function initialSchedule(today, firstDueInDays = 1) {
  return { stage: 0, dueDate: addDays(today, firstDueInDays), lastRevised: null }
}

export function afterRevision(schedule, rating, today) {
  let stage = schedule.stage
  if (rating === 'easy') stage = Math.min(stage + 1, INTERVALS.length - 1)
  else if (rating === 'difficult') stage = 0
  return { stage, dueDate: addDays(today, INTERVALS[stage]), lastRevised: today }
}

// { kind: 'overdue' | 'due' | 'upcoming', days } where days is how many days late/early.
export function dueState(schedule, today) {
  const diff = daysBetween(schedule.dueDate, today) // >0 means late
  if (diff > 0) return { kind: 'overdue', days: diff }
  if (diff === 0) return { kind: 'due', days: 0 }
  return { kind: 'upcoming', days: -diff }
}
