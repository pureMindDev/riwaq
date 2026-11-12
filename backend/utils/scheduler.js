// A deliberately simple revision schedule. It SUGGESTS when to revise next; it cannot guarantee retention.
//   easy -> longer gap, moderate -> same gap, difficult -> back to tomorrow.
import { addDays, daysBetween } from './dates.js'

export const INTERVALS = [1, 3, 7, 14, 30, 60]

export const initialSchedule = (today, firstDueInDays = 1) => ({ stage: 0, dueDate: addDays(today, firstDueInDays), lastRevised: null })

export function afterRevision(schedule, rating, today) {
  let stage = schedule.stage
  if (rating === 'easy') stage = Math.min(stage + 1, INTERVALS.length - 1)
  else if (rating === 'difficult') stage = 0
  return { stage, dueDate: addDays(today, INTERVALS[stage]), lastRevised: today }
}

export function dueState(schedule, today) {
  const late = daysBetween(schedule.dueDate, today)
  if (late > 0) return { kind: 'overdue', days: late }
  if (late === 0) return { kind: 'due', days: 0 }
  return { kind: 'upcoming', days: -late }
}
