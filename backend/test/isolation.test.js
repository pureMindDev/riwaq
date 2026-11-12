// One learner must never be able to see or change another learner's data.
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startStack, dbSkip, ANSWERS } from './helpers.js'

let s, alice, bob, alicePassage
before(async () => {
  if (dbSkip) return
  s = await startStack()
  alice = await s.register('alice@example.com')
  bob = await s.register('bob@example.com')
  for (const u of [alice, bob]) await s.call('POST', '/api/assessment', { token: u.token, body: { answers: ANSWERS.ready } })
  const r = await s.call('POST', '/api/tahfidh/passages', { token: alice.token, body: { surah: 1, from: 1, to: 3, status: 'memorised' } })
  alicePassage = r.body.passage.id
})
after(async () => { if (s) await s.close() })
const opts = { skip: dbSkip }

test('another learner cannot read, change, revise or delete my passage (404, not 403)', opts, async () => {
  const t = bob.token, id = alicePassage
  const attempts = [
    ['GET', `/api/tahfidh/passages/${id}`],
    ['DELETE', `/api/tahfidh/passages/${id}`],
    ['POST', `/api/tahfidh/passages/${id}/session`],
    ['PATCH', `/api/tahfidh/passages/${id}/status`, { status: 'needs_review' }],
    ['PATCH', `/api/tahfidh/passages/${id}/position`, { verse: 2 }],
    ['POST', `/api/murajaah/passages/${id}/complete`, { submissionId: '6ae2c3c5913ae947a40a1b0c' }],
    ['PATCH', `/api/murajaah/passages/${id}/schedule`, { dueDate: new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10) }],
    ['GET', `/api/tahfidh/passages/${id}/recitations`],
  ]
  for (const [m, p, body] of attempts) assert.equal((await s.call(m, p, { token: t, body })).status, 404, `${m} ${p}`)
  const mine = await s.call('GET', `/api/tahfidh/passages/${id}`, { token: alice.token })
  assert.equal(mine.body.passage.status, 'memorised') // untouched by the attempts
})

test('lists contain only my own data', opts, async () => {
  const b = await s.call('GET', '/api/tahfidh/passages', { token: bob.token })
  assert.deepEqual(b.body.passages, [])
  assert.equal((await s.call('GET', '/api/murajaah', { token: bob.token })).body.all.length, 0)
  assert.equal((await s.call('GET', '/api/student/progress', { token: bob.token })).body.memorisedVerses, 0)
  const a = await s.call('GET', '/api/student/progress', { token: alice.token })
  assert.equal(a.body.memorisedVerses, 3)
})

test('the same verses can be recorded independently by two learners', opts, async () => {
  const r = await s.call('POST', '/api/tahfidh/passages', { token: bob.token, body: { surah: 1, from: 1, to: 3, status: 'learning' } })
  assert.equal(r.status, 201)
})

test('milestones are private too', opts, async () => {
  await s.call('POST', '/api/tahfidh/passages', { token: alice.token, body: { surah: 2, from: 1, to: 10, status: 'memorised' } })
  const a = await s.call('GET', '/api/milestones', { token: alice.token })
  assert.equal(a.body.milestones.length, 1)
  const id = a.body.milestones[0].id
  assert.equal((await s.call('GET', `/api/milestones/${id}`, { token: bob.token })).status, 404)
  assert.equal((await s.call('GET', '/api/milestones', { token: bob.token })).body.milestones.length, 0)
})

test('malformed ids are rejected with 400', opts, async () => {
  assert.equal((await s.call('GET', '/api/tahfidh/passages/not-an-id', { token: alice.token })).status, 400)
  assert.equal((await s.call('GET', '/api/milestones/123', { token: alice.token })).status, 400)
})
