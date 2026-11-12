// Recording uploads are limited per signed-in learner (they can be forwarded to a paid/limited engine).
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startStack, dbSkip } from './helpers.js'

let s
before(async () => { if (!dbSkip) s = await startStack({ env: { UPLOAD_RATE_LIMIT_MAX: '2' } }) })
after(async () => { if (s) await s.close() })

const upload = (token) => s.call('POST', '/api/recitation/analyze?surah=1&from=1&to=1', { token, raw: Buffer.from('audio'), headers: { 'Content-Type': 'audio/webm' } })

test('upload limit is per learner and returns 429 with Retry-After once exceeded', { skip: dbSkip }, async () => {
  const a = await s.register()
  const b = await s.register()
  const codes = []
  for (let i = 0; i < 3; i++) codes.push((await upload(a.token)).status)
  assert.notEqual(codes[0], 429)
  assert.notEqual(codes[1], 429)
  assert.equal(codes[2], 429)
  assert.notEqual((await upload(b.token)).status, 429, 'another learner is not affected')
  const res = await fetch(s.url + '/api/recitation/analyze?surah=1&from=1&to=1', { method: 'POST', headers: { Authorization: `Bearer ${a.token}`, 'Content-Type': 'audio/webm' }, body: 'audio' })
  assert.equal(res.status, 429)
  assert.ok(Number(res.headers.get('retry-after')) > 0)
})

test('unauthenticated uploads are refused (401) before any limit or body handling', { skip: dbSkip }, async () => {
  assert.equal((await upload(undefined)).status, 401)
})
