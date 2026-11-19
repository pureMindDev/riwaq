// The AI letter check route: validation, auth, key forwarding and safe handling of a misbehaving engine.
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { startStack, dbSkip } from './helpers.js'
import { LETTERS } from '../config/foundationCurriculum.js'

let s, engine, mode = 'match', seen = []
before(async () => {
  engine = http.createServer((req, res) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      seen.push({ url: req.url, key: req.headers['x-engine-key'], type: req.headers['content-type'], size: Buffer.concat(chunks).length })
      if (mode === 'down') return req.socket.destroy()
      if (mode === '500') { res.writeHead(500); return res.end('boom') }
      if (mode === '400') { res.writeHead(400); return res.end('{}') }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      if (mode === 'garbage') return res.end('<html>not json</html>')
      if (mode === 'badshape') return res.end(JSON.stringify({ result: 'perfect!' }))
      res.end(JSON.stringify(mode === 'fix'
        ? { result: 'fix', expected: 'ص', heard: 'ص', hints: [{ message: 'Say it heavy.', secret: 'x' }, { nope: 1 }], confidence: 0.9, stack: 'leak' }
        : { result: 'match', expected: 'ب', heard: 'ب' }))
    })
  })
  await new Promise((r) => engine.listen(0, r))
  if (!dbSkip) s = await startStack({ env: { LETTER_ENGINE_URL: `http://localhost:${engine.address().port}/`, LETTER_ENGINE_KEY: 'k-123' } })
})
after(async () => { if (s) await s.close(); engine.closeAllConnections(); await new Promise((r) => engine.close(r)) })

const check = (token, letter = 'ba', raw = Buffer.from('audio')) => s.call('POST', `/api/letters/check?letter=${letter}`, { token, raw, headers: { 'Content-Type': 'audio/webm' } })

test('requires sign-in; the status endpoint says the letter check is available', { skip: dbSkip }, async () => {
  assert.equal((await check(undefined)).status, 401)
  assert.equal((await s.call('GET', '/api/status')).body.letterCheck.available, true)
})

test('forwards the Arabic letter and the engine key, returns only a safe, shaped answer', { skip: dbSkip }, async () => {
  const { token } = await s.register()
  seen = []; mode = 'match'
  const r = await check(token, 'ba')
  assert.equal(r.status, 200)
  assert.deepEqual([r.body.result, r.body.expected, r.body.heard, r.body.experimental], ['match', 'ب', 'ب', true])
  assert.deepEqual([seen[0].url, seen[0].key, seen[0].type, seen[0].size], [`/letter?letter=${encodeURIComponent('ب')}`, 'k-123', 'audio/webm', 5])
  mode = 'fix'
  const f = (await check(token, 'sad')).body
  assert.deepEqual([f.result, f.hints, f.confidence], ['fix', [{ message: 'Say it heavy.' }], 0.9])
  assert.ok(!('stack' in f) && !JSON.stringify(f).includes('secret'))
})

test('every one of the 28 letter ids is accepted and mapped to its own Arabic character', { skip: dbSkip }, async () => {
  const { token } = await s.register()
  mode = 'match'; seen = []
  for (const l of LETTERS) assert.equal((await check(token, l.id)).status, 200, l.id)
  assert.deepEqual(seen.map((x) => decodeURIComponent(x.url.split('=')[1])), LETTERS.map((l) => l.char))
})

test('bad input: unknown letter, missing letter, empty body', { skip: dbSkip }, async () => {
  const { token } = await s.register()
  assert.equal((await check(token, 'zzz')).status, 404)
  assert.equal((await s.call('POST', '/api/letters/check', { token, raw: Buffer.from('a'), headers: { 'Content-Type': 'audio/webm' } })).status, 400)
  assert.equal((await check(token, 'ba', Buffer.alloc(0))).status, 400)
})

test('a failing, unreachable or confused engine becomes a clean error, never a leak or a hang', { skip: dbSkip }, async () => {
  const { token } = await s.register()
  for (const [m, status, code] of [['down', 502, 'LETTER_ENGINE_UNREACHABLE'], ['500', 502, 'LETTER_ENGINE_ERROR'], ['garbage', 502, 'LETTER_ENGINE_BAD_RESPONSE'], ['badshape', 502, 'LETTER_ENGINE_BAD_RESPONSE'], ['400', 400, 'INVALID_AUDIO']]) {
    mode = m
    const r = await check(token)
    assert.deepEqual([m, r.status, r.body.error.code], [m, status, code])
  }
})

test('not configured: 501 and status says unavailable', { skip: dbSkip }, async () => {
  const t = await startStack({ db: 'reuse' })
  try {
    const { token } = await t.register()
    assert.equal((await t.call('GET', '/api/status')).body.letterCheck.available, false)
    const r = await t.call('POST', '/api/letters/check?letter=ba', { token, raw: Buffer.from('a'), headers: { 'Content-Type': 'audio/webm' } })
    assert.deepEqual([r.status, r.body.error.code], [501, 'LETTER_ENGINE_NOT_CONFIGURED'])
  } finally { await t.close() }
})
