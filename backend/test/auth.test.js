import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startStack, dbSkip } from './helpers.js'
import { User } from '../models/User.js'
import { AuthSession } from '../models/AuthSession.js'
import { Passage } from '../models/Passage.js'
import { Student } from '../models/Student.js'

let s
before(async () => { if (!dbSkip) s = await startStack() })
after(async () => { if (s) await s.close() })
const opts = { skip: dbSkip }

test('register creates an account, a student profile, and a session; password is hashed', opts, async () => {
  const { token, email } = await s.register('Ada@Example.com')
  assert.ok(token.length >= 40)
  const user = await User.findOne({ email: 'ada@example.com' }) // email is normalised
  assert.ok(user)
  assert.match(user.passwordHash, /^scrypt\$/)
  assert.ok(!user.passwordHash.includes('correct-horse-9'))
  assert.ok(await Student.findOne({ user: user._id }))
  const stored = await AuthSession.findOne({ user: user._id })
  assert.notEqual(stored.tokenHash, token) // only a hash of the token is stored
  assert.equal(email, 'Ada@Example.com')
  const me = await s.call('GET', '/api/auth/me', { token })
  assert.equal(me.body.user.email, 'ada@example.com')
  assert.ok(!JSON.stringify(me.body).includes('passwordHash'))
})

test('register validates input and rejects duplicate emails', opts, async () => {
  const bad = [
    { name: '', email: 'a@b.co', password: 'longenough1' },
    { name: 'x', email: 'not-an-email', password: 'longenough1' },
    { name: 'x', email: 'a@b.co', password: 'short' },
  ]
  for (const body of bad) assert.equal((await s.call('POST', '/api/auth/register', { body })).status, 400)
  await s.register('dup@example.com')
  const again = await s.call('POST', '/api/auth/register', { body: { name: 'x', email: 'DUP@example.com', password: 'longenough1' } })
  assert.deepEqual([again.status, again.body.error.code], [409, 'EMAIL_TAKEN'])
})

test('login works with the right password only; the error never says which part was wrong', opts, async () => {
  await s.register('login@example.com')
  const ok = await s.call('POST', '/api/auth/login', { body: { email: 'LOGIN@example.com', password: 'correct-horse-9' } })
  assert.equal(ok.status, 200)
  const wrong = await s.call('POST', '/api/auth/login', { body: { email: 'login@example.com', password: 'nope-nope-nope' } })
  const unknown = await s.call('POST', '/api/auth/login', { body: { email: 'nobody@example.com', password: 'nope-nope-nope' } })
  assert.equal(wrong.status, 401)
  assert.deepEqual(wrong.body, unknown.body)
})

test('protected routes need a valid token; logout revokes it', opts, async () => {
  for (const [m, p] of [['GET', '/api/student'], ['GET', '/api/plan/today'], ['GET', '/api/tahfidh/passages'], ['GET', '/api/murajaah'], ['GET', '/api/milestones'], ['POST', '/api/recitation/analyze']]) {
    assert.equal((await s.call(m, p)).status, 401, p)
    assert.equal((await s.call(m, p, { token: 'x'.repeat(43) })).status, 401, p)
  }
  const { token } = await s.register()
  assert.equal((await s.call('GET', '/api/student', { token })).status, 200)
  assert.equal((await s.call('POST', '/api/auth/logout', { token })).status, 204)
  assert.equal((await s.call('GET', '/api/student', { token })).status, 401)
})

test('an expired session is refused', opts, async () => {
  const { token, user } = await s.register()
  await AuthSession.updateMany({ user: user.id }, { expiresAt: new Date(Date.now() - 1000) })
  assert.equal((await s.call('GET', '/api/auth/me', { token })).status, 401)
})

test('deleting the account removes the learner\'s data', opts, async () => {
  const { token, user } = await s.register()
  await s.call('POST', '/api/assessment', { token, body: { answers: { letters: 2, vowels: 2, joining: 2, quranReading: 2, memorised: 'none', minutes: 30 } } })
  await s.call('POST', '/api/tahfidh/passages', { token, body: { surah: 1, from: 1, to: 2, status: 'learning' } })
  assert.equal(await Passage.countDocuments({ user: user.id }), 1)
  assert.equal((await s.call('DELETE', '/api/auth/me', { token })).status, 204)
  assert.equal(await Passage.countDocuments({ user: user.id }), 0)
  assert.equal(await Student.countDocuments({ user: user.id }), 0)
  assert.equal(await User.countDocuments({ _id: user.id }), 0)
})

test('malformed JSON and oversized bodies get clean errors', opts, async () => {
  const r = await s.call('POST', '/api/auth/login', { body: '{not json' })
  assert.deepEqual([r.status, r.body.error.code], [400, 'INVALID_JSON'])
  const big = await s.call('POST', '/api/auth/login', { body: { email: 'a@b.co', password: 'x'.repeat(200_000) } })
  assert.equal(big.status, 413)
})

test('sign-in attempts are rate limited', opts, async () => {
  const limited = await startStack({ db: 'reuse', env: { AUTH_RATE_LIMIT_MAX: '3' } })
  const codes = []
  for (let i = 0; i < 5; i++) codes.push((await limited.call('POST', '/api/auth/login', { body: { email: 'a@b.co', password: 'whatever-12' } })).status)
  await limited.close()
  assert.deepEqual(codes, [401, 401, 401, 429, 429])
})
