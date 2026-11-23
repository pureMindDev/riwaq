// The AI passage checker (hifz + muraja'ah): adapter, feedback shape, and that its verdict decides progress.
// The engine is a STUB whose "audio" is a JSON script of what it "heard" (the real model is not run here).
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { startStack, dbSkip, ANSWERS } from './helpers.js'
import { passageFeedback } from '../utils/recitation/passageFeedback.js'

let s, engine, seen = [], mode = 'ok'
const W = (text, status = 'ok', extra = {}) => ({ aya: 1, text, status, problems: [], advice: [], ...extra })

before(async () => {
  engine = http.createServer((req, res) => {
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      seen.push({ url: req.url, key: req.headers['x-engine-key'] })
      if (mode === 'down') return req.socket.destroy()
      if (mode === '500') { res.writeHead(500); return res.end('x') }
      if (mode === '400') { res.writeHead(400); return res.end('{}') }
      res.writeHead(200, { 'Content-Type': 'application/json' })
      if (mode === 'garbage') return res.end('<html>')
      if (mode === 'badshape') return res.end(JSON.stringify({ words: [{ text: 'x', status: 'great' }] }))
      res.end(Buffer.concat(chunks).toString('utf8') || '{}')
    })
  })
  await new Promise((r) => engine.listen(0, r))
  if (!dbSkip) s = await startStack({ env: { LETTER_ENGINE_URL: `http://localhost:${engine.address().port}`, LETTER_ENGINE_KEY: 'k' } })
})
after(async () => { if (s) await s.close(); engine.closeAllConnections(); await new Promise((r) => engine.close(r)) })

test('feedback: all ok passes; tajweed advice never blocks', () => {
  const f = passageFeedback({ reliable: true, words: [W('a'), W('b', 'ok', { advice: [{ message: 'Madd: hold it 4 counts.', rule: 'Madd' }] })] })
  assert.equal(f.verdict, 'passed')
  assert.equal(f.advice.length, 1)
  assert.deepEqual(f.corrections, [])
  assert.deepEqual(f.stats, { words: 2, correct: 2 })
})

test('feedback: wrong, skipped and stopped-early words are named, and block', () => {
  const f = passageFeedback({
    reliable: true,
    words: [W('a'), W('b', 'wrong', { problems: [{ kind: 'vowel', span: 'بِ', expected: 'بِ', heard: 'ب' }] }), W('c', 'omitted'), W('d', 'not_reached'), W('e', 'not_reached')],
  })
  assert.equal(f.verdict, 'try_again')
  assert.deepEqual(f.corrections.map((c) => [c.word, c.type]), [[2, 'vowel'], [3, 'skipped'], [4, 'stopped_early']])
  assert.equal(f.stats.correct, 1)
})

test('feedback: an unreliable check is "unclear", never a pass or a fail', () => {
  assert.equal(passageFeedback({ reliable: false, reason: 'no_speech', words: [W('a')] }).verdict, 'unclear')
  assert.equal(passageFeedback({ reliable: false, reason: 'too_little_match', words: [W('a')] }).verdict, 'unclear')
})

const opts = { skip: dbSkip }
const call = (u, m, p, body) => s.call(m, p, { token: u.token, body })
const say = (u, path, check) => s.call('POST', path, { token: u.token, raw: Buffer.from(JSON.stringify(check)), headers: { 'Content-Type': 'audio/webm' } })
async function learner() {
  const u = await s.register()
  await call(u, 'POST', '/api/assessment', { answers: ANSWERS.ready })
  await call(u, 'PATCH', '/api/student/settings', { start: { surah: 1, verse: 1 }, direction: 'ascending', newVerses: 2 })
  const plan = (await s.call('GET', '/api/plan/today', { token: u.token })).body.plan
  return { u, id: plan.items[0].passageId }
}
async function words(u, id, status = () => 'ok') {
  const p = (await call(u, 'GET', `/api/tahfidh/passages/${id}`)).body.passage
  const vs = (await s.call('GET', `/api/chapters/${p.surah}/verses?from=${p.from}&to=${p.to}`)).body.verses
  const out = []
  for (const v of vs) for (const t of v.textUthmani.split(' ')) out.push({ aya: Number(v.verseKey.split(':')[1]), text: t, status: status(out.length), problems: [], advice: [] })
  return out
}

test('status says the AI checker is the recitation mode', opts, async () => {
  const st = (await s.call('GET', '/api/status')).body
  assert.deepEqual([st.recitation.available, st.recitation.mode], [true, 'ai'])
})

test('the AI verdict decides "memorised": wrong or incomplete blocks, a clean passage unlocks', opts, async () => {
  const { u, id } = await learner()
  const url = `/api/tahfidh/passages/${id}/recitations`
  assert.equal((await call(u, 'POST', `/api/tahfidh/passages/${id}/memorised`, {})).body.error.code, 'MUALLIM_PASS_REQUIRED')

  const bad = await say(u, url, { reliable: true, words: await words(u, id, (i) => (i === 1 ? 'omitted' : 'ok')) })
  assert.deepEqual([bad.status, bad.body.passed, bad.body.corrections[0].type], [201, false, 'skipped'])
  assert.equal((await call(u, 'POST', `/api/tahfidh/passages/${id}/memorised`, {})).status, 409)

  const unclear = await say(u, url, { reliable: false, reason: 'no_speech', words: await words(u, id) })
  assert.equal(unclear.body.verdict, 'unclear')
  assert.equal((await call(u, 'POST', `/api/tahfidh/passages/${id}/memorised`, {})).status, 409)

  seen = []
  const good = await say(u, url, { reliable: true, words: await words(u, id) })
  assert.equal(good.body.passed, true)
  assert.match(seen[0].url, /^\/recite\?surah=\d+&from=\d+&to=\d+$/)
  assert.equal(seen[0].key, 'k')
  assert.equal((await call(u, 'POST', `/api/tahfidh/passages/${id}/memorised`, {})).status, 200)
})

test('muraja\'ah rating follows the AI verdict', opts, async () => {
  const { u, id } = await learner()
  const url = `/api/tahfidh/passages/${id}/recitations`
  const ok = await say(u, url, { reliable: true, words: await words(u, id) })
  assert.equal((await call(u, 'POST', `/api/tahfidh/passages/${id}/memorised`, {})).status, 200)
  assert.equal(ok.body.passed, true)
  const r = await say(u, url, { reliable: true, words: await words(u, id) })
  const done = await call(u, 'POST', `/api/murajaah/passages/${id}/complete`, { submissionId: r.body.id })
  assert.equal(done.status, 200, JSON.stringify(done.body))
})

test('a misbehaving AI checker gives a clean error, never a pass', opts, async () => {
  const { u, id } = await learner()
  const url = `/api/tahfidh/passages/${id}/recitations`
  for (const [m, status] of [['down', 502], ['500', 502], ['garbage', 502], ['badshape', 502], ['400', 400]]) {
    mode = m
    const r = await say(u, url, { reliable: true, words: [] })
    assert.equal(r.status, status, m)
    assert.ok(r.body.error && !r.body.passed, m)
  }
  mode = 'ok'
  assert.equal((await call(u, 'POST', `/api/tahfidh/passages/${id}/memorised`, {})).status, 409)
})
