// Tests the HTTP API against the local MOCK provider (no real Qur'an data).
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { createMockProvider, MOCK } from '../dev/mock-provider.js'
import { loadConfig } from '../src/config.js'
import { createApp } from '../src/app.js'
import { createQuranService } from '../src/services/quranFoundation.js'
import { createRecitationEngine } from '../src/recitation/engine.js'

const listen = (server) => new Promise((r) => server.listen(0, () => r(server.address().port)))
let mock, mockPort, apiServer, base, engineStub, stubPort, apiNoCreds, baseNoCreds

function envFor(extra = {}) {
  return { QF_AUTH_URL: `http://localhost:${mockPort}`, QF_API_URL: `http://localhost:${mockPort}`, QF_AUDIO_BASE_URL: `http://localhost:${mockPort}/audio/`, ...extra }
}
function build(env) {
  const config = loadConfig(env)
  const quran = createQuranService({ config })
  const engine = createRecitationEngine({ config })
  return http.createServer(createApp({ config, quran, engine }))
}

before(async () => {
  mock = createMockProvider()
  mockPort = await listen(mock.server)
  // Engine stub: pretends to be a recognition service (TEST ONLY).
  engineStub = http.createServer((req, res) => {
    req.resume()
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ words: [{ text: 'نص', confidence: 0.9 }, { text: 'تجريبي', confidence: 0.9 }] }))
    })
  })
  stubPort = await listen(engineStub)
  apiServer = build(envFor({ QF_CLIENT_ID: MOCK.clientId, QF_CLIENT_SECRET: MOCK.clientSecret, RECITATION_ENGINE_URL: `http://localhost:${stubPort}` }))
  base = `http://localhost:${await listen(apiServer)}`
  apiNoCreds = build(envFor())
  baseNoCreds = `http://localhost:${await listen(apiNoCreds)}`
})
after(() => [mock.server, engineStub, apiServer, apiNoCreds].forEach((s) => s.close()))

const get = (p, b = base) => fetch(b + p).then(async (r) => ({ status: r.status, body: await r.json() }))

test('without credentials the API says so clearly (503) and invents nothing', async () => {
  const r = await get('/api/chapters', baseNoCreds)
  assert.equal(r.status, 503)
  assert.equal(r.body.error.code, 'PROVIDER_NOT_CONFIGURED')
  const s = await get('/api/status', baseNoCreds)
  assert.equal(s.body.quran.configured, false)
})

test('lists chapters in a clean shape', async () => {
  const r = await get('/api/chapters')
  assert.equal(r.status, 200)
  assert.equal(r.body.chapters[0].versesCount, 3)
  assert.equal(r.body.chapters[0].nameSimple, 'Test Surah A')
})

test('verse range is exact and ordered; pagination is followed (60 verses over 2 pages)', async () => {
  const all = await get('/api/chapters/2/verses')
  assert.equal(all.body.verses.length, 60)
  assert.equal(all.body.verses[59].verseKey, '2:60')
  const range = await get('/api/chapters/2/verses?from=48&to=52')
  assert.deepEqual(range.body.verses.map((v) => v.verseNumber), [48, 49, 50, 51, 52])
})

test('validation rejects bad input with 400', async () => {
  for (const p of ['/api/chapters/abc', '/api/chapters/0', '/api/chapters/115', '/api/chapters/1/verses?from=2&to=1', '/api/chapters/1/verses?to=99', '/api/chapters/1/verses?from=-1', '/api/chapters/1/audio']) {
    const r = await get(p)
    assert.equal(r.status, 400, p)
  }
})

test('a Surah the provider does not have returns 404, not substitute data', async () => {
  const r = await get('/api/chapters/3/verses')
  assert.equal(r.status, 404)
})

test('reciters and audio URLs come from the provider and resolve', async () => {
  const rec = await get('/api/reciters')
  assert.equal(rec.body.reciters[0].id, 901)
  const a = await get('/api/chapters/1/audio?reciter=901')
  assert.equal(a.body.audio.length, 3)
  assert.match(a.body.audio[0].url, new RegExp(`^http://localhost:${mockPort}/audio/mock/901/1_1\\.wav$`))
  const f = await fetch(a.body.audio[0].url)
  assert.equal(f.status, 200)
})

test('token is requested once and reused', async () => {
  assert.equal(mock.calls.token, 1)
})

test('bad credentials surface as a 502 without leaking the secret', async () => {
  const bad = build(envFor({ QF_CLIENT_ID: MOCK.clientId, QF_CLIENT_SECRET: 'wrong-secret' }))
  const port = await listen(bad)
  const r = await get('/api/chapters', `http://localhost:${port}`)
  bad.close()
  assert.equal(r.status, 502)
  assert.equal(r.body.error.code, 'PROVIDER_AUTH')
  assert.ok(!JSON.stringify(r.body).includes('wrong-secret'))
})

test('an unreachable provider returns 502', async () => {
  const dead = build({ QF_CLIENT_ID: 'a', QF_CLIENT_SECRET: 'b', QF_AUTH_URL: 'http://localhost:1', QF_API_URL: 'http://localhost:1' })
  const port = await listen(dead)
  const r = await get('/api/chapters', `http://localhost:${port}`)
  dead.close()
  assert.equal(r.status, 502)
  assert.equal(r.body.error.code, 'PROVIDER_UNREACHABLE')
})

test('an expired token (401) is refreshed and retried once', async () => {
  let calls = 0
  const fakeFetch = async (url) => {
    const u = String(url)
    if (u.includes('/oauth2/token')) return new Response(JSON.stringify({ access_token: `t${++calls}`, expires_in: 3600 }), { status: 200 })
    return calls < 2 ? new Response('{}', { status: 401 }) : new Response(JSON.stringify({ chapters: [{ id: 1, verses_count: 7, name_simple: 'x', name_arabic: 'y' }] }), { status: 200 })
  }
  const svc = createQuranService({ config: loadConfig({ QF_CLIENT_ID: 'a', QF_CLIENT_SECRET: 'b' }), fetchImpl: fakeFetch })
  const chapters = await svc.listChapters()
  assert.equal(chapters.length, 1)
  assert.equal(calls, 2)
})

test('malformed provider data is rejected, not passed on', async () => {
  const fakeFetch = async (url) =>
    String(url).includes('/oauth2/token')
      ? new Response(JSON.stringify({ access_token: 't' }), { status: 200 })
      : new Response(JSON.stringify({ verses: [{ verse_number: 1, verse_key: '1:1' }], pagination: {} }), { status: 200 })
  const svc = createQuranService({ config: loadConfig({ QF_CLIENT_ID: 'a', QF_CLIENT_SECRET: 'b' }), fetchImpl: async (u, o) => (String(u).includes('/chapters/1') && !String(u).includes('verses') ? new Response(JSON.stringify({ chapter: { id: 1, verses_count: 1 } }), { status: 200 }) : fakeFetch(u, o)) })
  await assert.rejects(() => svc.getVerses(1, 1, 1), { code: 'PROVIDER_BAD_RESPONSE' })
})

test('recitation analyze: 501 when no engine is configured', async () => {
  const r = await fetch(`${baseNoCreds}/api/recitation/analyze?surah=1&from=1&to=1`, { method: 'POST', headers: { 'Content-Type': 'audio/webm' }, body: Buffer.from([1, 2, 3]) })
  assert.equal(r.status, 501)
})

test('recitation analyze: validates input and returns an alignment from the (stub) engine', async () => {
  const bad = await fetch(`${base}/api/recitation/analyze?surah=x&from=1&to=1`, { method: 'POST', headers: { 'Content-Type': 'audio/webm' }, body: Buffer.from([1]) })
  assert.equal(bad.status, 400)
  const ok = await fetch(`${base}/api/recitation/analyze?surah=1&from=1&to=1`, { method: 'POST', headers: { 'Content-Type': 'audio/webm' }, body: Buffer.from([1, 2, 3]) })
  assert.equal(ok.status, 200)
  const body = await ok.json()
  // mock verse = "نص تجريبي ليس من القرآن رقم 1": stub heard only the first two words
  assert.equal(body.result.items[0].status, 'correct')
  assert.equal(body.result.reliable, true)
  assert.equal(body.result.items[1].status, 'correct')
  assert.ok(body.result.items.slice(2).every((i) => i.status === 'not_reached'))
})

test('unknown API route is a JSON 404', async () => {
  const r = await get('/api/nope')
  assert.equal(r.status, 404)
})

test('status reports the engine as not validated by default', async () => {
  const r = await get('/api/status')
  assert.equal(r.body.recitation.available, true)
  assert.equal(r.body.recitation.validated, false)
})

test('check-engine script runs end to end with the mock provider and a stub engine', async () => {
  const { runCheck } = await import('../scripts/check-engine.js')
  const config = loadConfig(envFor({ QF_CLIENT_ID: MOCK.clientId, QF_CLIENT_SECRET: MOCK.clientSecret, RECITATION_ENGINE_URL: `http://localhost:${stubPort}` }))
  const out = await runCheck({ quran: createQuranService({ config }), engine: createRecitationEngine({ config }), surah: 1, from: 1, to: 2, reciterId: 901, log: () => {} })
  assert.equal(out.rows.length, 2)
  assert.equal(out.rows[0].words, 6) // placeholder sentence has 6 words
  assert.ok(out.rows.every((r) => !r.error))
})
