// The lesson list carries real per-lesson stats (best score, attempts) taken only from saved quiz results.
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startStack, dbSkip } from './helpers.js'
import { quizDefinition } from '../services/foundationService.js'
import { LESSONS } from '../config/foundationCurriculum.js'

let s
before(async () => { if (!dbSkip) s = await startStack() })
after(async () => { if (s) await s.close() })

test('lesson list: no invented numbers; best score and attempts come from saved quiz attempts', { skip: dbSkip }, async () => {
  const { token } = await s.register()
  const list = async () => (await s.call('GET', '/api/foundation/lessons', { token })).body.lessons
  let l1 = (await list())[0]
  assert.deepEqual([l1.id, l1.attempts, l1.best, l1.completed, l1.unlocked], ['letters-1', 0, null, false, true])
  assert.ok(l1.preview.length > 0 && !('answer' in l1))
  assert.equal((await list())[1].unlocked, false)
  // Letters lessons also list their letters (curriculum data only: no answers, no per-letter scores).
  const all = await list()
  assert.deepEqual(Object.keys(l1.letters[0]).sort(), ['char', 'id', 'joins', 'name', 'sound'])
  assert.equal(all.filter((l) => l.letters).length, LESSONS.filter((l) => l.type === 'letters').length)
  assert.ok(all.filter((l) => l.type !== 'letters').every((l) => !('letters' in l)))

  const def = quizDefinition('letters-1')
  const right = Object.fromEntries(def.map((q) => [q.id, q.answer]))
  await s.call('POST', '/api/foundation/lessons/letters-1/quiz', { token, body: { answers: {} } }) // 0 correct
  const half = Object.fromEntries(def.slice(0, 5).map((q) => [q.id, q.answer]))
  await s.call('POST', '/api/foundation/lessons/letters-1/quiz', { token, body: { answers: half } }) // 5 of 7
  l1 = (await list())[0]
  assert.deepEqual([l1.attempts, l1.best], [2, { score: 5, total: def.length }])

  await s.call('POST', '/api/foundation/lessons/letters-1/quiz', { token, body: { answers: right } })
  await s.call('POST', '/api/foundation/lessons/letters-1/quiz', { token, body: { answers: {} } }) // a later bad try never lowers "best"
  l1 = (await list())[0]
  assert.deepEqual([l1.attempts, l1.best], [4, { score: def.length, total: def.length }])
  assert.equal((await s.call('POST', '/api/foundation/lessons/letters-1/complete', { token })).status, 200)
  const after = await list()
  assert.deepEqual([after[0].completed, after[1].unlocked], [true, true])
  assert.equal(after.length, LESSONS.length)
  // Other learners see none of it.
  const other = await s.register()
  assert.equal((await s.call('GET', '/api/foundation/lessons', { token: other.token })).body.lessons[0].attempts, 0)
})

test('lesson detail reports a saved passing quiz (so Complete lesson survives a reload)', { skip: dbSkip }, async () => {
  const { token } = await s.register()
  const get = async () => (await s.call('GET', '/api/foundation/lessons/letters-1', { token })).body.lesson
  assert.equal((await get()).quizPassed, false)
  const def = quizDefinition('letters-1')
  await s.call('POST', '/api/foundation/lessons/letters-1/quiz', { token, body: { answers: {} } })
  assert.equal((await get()).quizPassed, false) // a failed try does not count
  await s.call('POST', '/api/foundation/lessons/letters-1/quiz', { token, body: { answers: Object.fromEntries(def.map((q) => [q.id, q.answer])) } })
  assert.equal((await get()).quizPassed, true)
})
