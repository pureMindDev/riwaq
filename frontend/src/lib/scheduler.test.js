import test from 'node:test'
import assert from 'node:assert/strict'
import { addDays, daysBetween, initialSchedule, afterRevision, dueState, INTERVALS } from './scheduler.js'

test('addDays crosses month and year boundaries', () => {
  assert.equal(addDays('2026-01-31', 1), '2026-02-01')
  assert.equal(addDays('2026-12-31', 1), '2027-01-01')
  assert.equal(addDays('2028-02-28', 1), '2028-02-29')
  assert.equal(addDays('2026-03-01', -1), '2026-02-28')
})

test('daysBetween', () => {
  assert.equal(daysBetween('2026-10-01', '2026-10-21'), 20)
  assert.equal(daysBetween('2026-10-21', '2026-10-20'), -1)
})

test('easy climbs the ladder and stops at the top', () => {
  let s = initialSchedule('2026-10-21', 0)
  const seen = []
  for (let i = 0; i < 8; i++) {
    s = afterRevision(s, 'easy', '2026-10-21')
    seen.push(s.stage)
  }
  assert.deepEqual(seen, [1, 2, 3, 4, 5, 5, 5, 5])
  assert.equal(s.dueDate, addDays('2026-10-21', INTERVALS[5]))
})

test('moderate keeps the same gap, difficult resets to tomorrow', () => {
  const s = { stage: 3, dueDate: '2026-10-21', lastRevised: null }
  assert.equal(afterRevision(s, 'moderate', '2026-10-21').stage, 3)
  const d = afterRevision(s, 'difficult', '2026-10-21')
  assert.equal(d.stage, 0)
  assert.equal(d.dueDate, '2026-10-22')
  assert.equal(d.lastRevised, '2026-10-21')
})

test('dueState reports overdue, due and upcoming', () => {
  const s = { stage: 0, dueDate: '2026-10-20', lastRevised: null }
  assert.deepEqual(dueState(s, '2026-10-22'), { kind: 'overdue', days: 2 })
  assert.deepEqual(dueState(s, '2026-10-20'), { kind: 'due', days: 0 })
  assert.deepEqual(dueState(s, '2026-10-18'), { kind: 'upcoming', days: 2 })
})
