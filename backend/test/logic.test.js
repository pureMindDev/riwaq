// Pure business rules (no database needed).
import test from 'node:test'
import assert from 'node:assert/strict'
import { rangeCovered, juzCoverage, gaps } from '../utils/juz.js'
import { recommend } from '../services/assessmentService.js'
import { quizDefinition, gradeQuiz } from '../services/foundationService.js'
import { LESSONS, LETTERS } from '../config/foundationCurriculum.js'
import { ANSWERS } from './helpers.js'

test('rangeCovered: needs every verse, across touching passages', () => {
  assert.equal(rangeCovered([[1, 5], [6, 10]], 1, 10), true)
  assert.equal(rangeCovered([[1, 5], [7, 10]], 1, 10), false)
  assert.equal(rangeCovered([[3, 10]], 1, 10), false)
  assert.equal(rangeCovered([], 1, 3), false)
})

test('gaps returns only the uncovered parts', () => {
  assert.deepEqual(gaps([[3, 4], [8, 9]], 1, 10), [[1, 2], [5, 7], [10, 10]])
  assert.deepEqual(gaps([[1, 10]], 1, 10), [])
  assert.deepEqual(gaps([], 5, 8), [[5, 8]])
})

test('juzCoverage: complete only when every range is covered; "contributed" ignores declared-only juz', () => {
  const map = [{ juz: 1, ranges: [{ surah: 1, from: 1, to: 3 }, { surah: 2, from: 1, to: 10 }] }]
  const half = [{ _id: 'a', surah: 1, from: 1, to: 3, source: 'self' }]
  assert.equal(juzCoverage(map, half)[0].complete, false)
  const full = [...half, { _id: 'b', surah: 2, from: 1, to: 10, source: 'self' }]
  const c = juzCoverage(map, full)[0]
  assert.deepEqual([c.complete, c.contributed, c.passageIds.length], [true, true, 2])
  const declared = full.map((p) => ({ ...p, source: 'declared' }))
  assert.deepEqual([juzCoverage(map, declared)[0].complete, juzCoverage(map, declared)[0].contributed], [true, false])
})

test('assessment: beginners -> foundation; ready readers -> tahfidh; hafiz -> muraja\'ah only', () => {
  assert.equal(recommend(ANSWERS.beginner).programme, 'foundation')
  assert.equal(recommend({ ...ANSWERS.ready, joining: 0, quranReading: 1 }).programme, 'foundation') // reading score too low
  const ready = recommend(ANSWERS.ready)
  assert.equal(ready.programme, 'tahfidh')
  assert.equal(ready.suggestedNewVerses, 3)
  assert.equal(recommend({ ...ANSWERS.ready, quranReading: 1, minutes: 15 }).suggestedNewVerses, 1) // achievable: never zero
  assert.equal(recommend(ANSWERS.hafiz).programme, 'murajaah_only')
  assert.ok(recommend(ANSWERS.ready).reasons.some((r) => /not a certified/.test(r)))
})

test('foundation quizzes: every lesson with a quiz has questions with a real answer among 2+ choices', () => {
  for (const l of LESSONS.filter((x) => x.quiz)) {
    const def = quizDefinition(l.id)
    assert.ok(def.length >= 5, l.id)
    for (const q of def) {
      assert.ok(q.pool.includes(q.answer), `${l.id}/${q.id}`)
      assert.ok(new Set(q.pool).size >= 2, `${l.id}/${q.id}`)
    }
  }
})

test('quiz grading counts every question, so skipping cannot pass', () => {
  const def = quizDefinition('letters-1')
  const all = Object.fromEntries(def.map((q) => [q.id, q.answer]))
  assert.equal(gradeQuiz('letters-1', all).passed, true)
  assert.equal(gradeQuiz('letters-1', {}).passed, false)
  const oneRight = { [def[0].id]: def[0].answer }
  const g = gradeQuiz('letters-1', oneRight)
  assert.deepEqual([g.score, g.total, g.passed], [1, def.length, false])
  const sixOfSeven = { ...all, [def[0].id]: 'wrong' }
  assert.equal(gradeQuiz('letters-1', sixOfSeven).passed, true) // 6/7 >= 80%
  assert.equal(gradeQuiz('letters-1', { ...sixOfSeven, [def[1].id]: 'wrong' }).passed, false) // 5/7 < 80%
})

test('curriculum data is consistent: 28 letters, unique ids, six non-joining letters', () => {
  assert.equal(LETTERS.length, 28)
  assert.equal(new Set(LETTERS.map((l) => l.id)).size, 28)
  assert.equal(new Set(LETTERS.map((l) => l.name)).size, 28) // quiz choices must be distinguishable
  assert.equal(LETTERS.filter((l) => !l.joins).length, 6)
  const covered = LESSONS.filter((l) => l.type === 'letters').flatMap((l) => l.letterIds)
  assert.equal(new Set(covered).size, 28)
})
