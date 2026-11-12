import test from 'node:test'
import assert from 'node:assert/strict'
import { INTERVALS, initialSchedule, afterRevision, dueState } from '../utils/scheduler.js'
import { addDays, daysBetween, todayIn, isValidTimeZone } from '../utils/dates.js'

test('addDays crosses month, year and leap-day boundaries', () => {
  assert.equal(addDays('2026-01-31', 1), '2026-02-01')
  assert.equal(addDays('2026-12-31', 1), '2027-01-01')
  assert.equal(addDays('2028-02-28', 1), '2028-02-29')
  assert.equal(addDays('2026-03-01', -1), '2026-02-28')
})

test('daysBetween ignores daylight-saving changes', () => {
  assert.equal(daysBetween('2026-03-28', '2026-03-30'), 2)
  assert.equal(daysBetween('2026-10-21', '2026-10-20'), -1)
})

test('"today" depends on the learner\'s time zone', () => {
  const instant = new Date('2026-10-21T23:30:00Z')
  assert.equal(todayIn('UTC', instant), '2026-10-21')
  assert.equal(todayIn('Pacific/Auckland', instant), '2026-10-22')
  assert.equal(todayIn('America/Los_Angeles', instant), '2026-10-21')
  assert.equal(isValidTimeZone('Africa/Lagos'), true)
  assert.equal(isValidTimeZone('Not/AZone'), false)
})

test('easy climbs the ladder and stops at the top; moderate stays; difficult resets', () => {
  let s = initialSchedule('2026-10-21', 0)
  const stages = []
  for (let i = 0; i < 8; i++) { s = afterRevision(s, 'easy', '2026-10-21'); stages.push(s.stage) }
  assert.deepEqual(stages, [1, 2, 3, 4, 5, 5, 5, 5])
  assert.equal(s.dueDate, addDays('2026-10-21', INTERVALS[5]))
  assert.equal(afterRevision({ stage: 3, dueDate: 'x' }, 'moderate', '2026-10-21').stage, 3)
  const d = afterRevision({ stage: 3, dueDate: 'x' }, 'difficult', '2026-10-21')
  assert.deepEqual([d.stage, d.dueDate, d.lastRevised], [0, '2026-10-22', '2026-10-21'])
})

test('dueState reports overdue, due and upcoming', () => {
  const s = { stage: 0, dueDate: '2026-10-20' }
  assert.deepEqual(dueState(s, '2026-10-22'), { kind: 'overdue', days: 2 })
  assert.deepEqual(dueState(s, '2026-10-20'), { kind: 'due', days: 0 })
  assert.deepEqual(dueState(s, '2026-10-18'), { kind: 'upcoming', days: 2 })
})
