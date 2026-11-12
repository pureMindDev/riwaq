// Qur'an provider routes, tested against the local MOCK provider (placeholder text, not Qur'an).
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startStack } from './helpers.js'
import { MOCK } from '../dev/mock-provider.js'
import { loadConfig } from '../config/index.js'
import { createQuranService } from '../services/quranFoundation.js'

let s
before(async () => { s = await startStack({ db: false }) })
after(() => s.close())
const get = (p) => s.call('GET', p)

test('lists chapters in a clean shape', async () => {
  const r = await get('/api/chapters')
  assert.equal(r.status, 200)
  assert.equal(r.body.chapters[0].versesCount, 3)
})

test('verse ranges are exact and ordered, and pagination is followed (60 verses over 2 pages)', async () => {
  const all = await get('/api/chapters/2/verses')
  assert.equal(all.body.verses.length, 60)
  const range = await get('/api/chapters/2/verses?from=48&to=52')
  assert.deepEqual(range.body.verses.map((v) => v.verseNumber), [48, 49, 50, 51, 52])
})

test('validation rejects bad input with 400', async () => {
  for (const p of ['/api/chapters/abc', '/api/chapters/0', '/api/chapters/115', '/api/chapters/1/verses?from=2&to=1', '/api/chapters/1/verses?to=99', '/api/chapters/1/verses?from=-1', '/api/chapters/1/audio']) {
    assert.equal((await get(p)).status, 400, p)
  }
})

test('a Surah the provider does not have returns 404, never substitute data', async () => {
  assert.equal((await get('/api/chapters/3/verses')).status, 404)
})

test('reciters, audio URLs and juz mapping come from the provider', async () => {
  assert.equal((await get('/api/reciters')).body.reciters[0].id, 901)
  const a = await get('/api/chapters/1/audio?reciter=901')
  assert.equal(a.body.audio.length, 3)
  assert.equal((await fetch(a.body.audio[0].url)).status, 200)
  const j = await get('/api/juzs')
  assert.deepEqual(j.body.juzs[0].ranges, [{ surah: 1, from: 1, to: 3 }, { surah: 2, from: 1, to: 10 }])
})

test('bad credentials surface as 502 without leaking the secret; no credentials gives 503', async () => {
  const bad = await startStack({ db: false, env: { QF_CLIENT_SECRET: 'wrong-secret' } })
  const r = await bad.call('GET', '/api/chapters')
  await bad.close()
  assert.equal(r.body.error.code, 'PROVIDER_AUTH')
  assert.ok(!JSON.stringify(r.body).includes('wrong-secret'))
  const none = await startStack({ db: false, env: { QF_CLIENT_ID: '', QF_CLIENT_SECRET: '' } })
  const n = await none.call('GET', '/api/chapters')
  await none.close()
  assert.deepEqual([n.status, n.body.error.code], [503, 'PROVIDER_NOT_CONFIGURED'])
})

test('an unreachable provider returns 502', async () => {
  const dead = await startStack({ db: false, dead: true })
  const r = await dead.call('GET', '/api/chapters')
  await dead.close()
  assert.deepEqual([r.status, r.body.error.code], [502, 'PROVIDER_UNREACHABLE'])
})

test('an expired token (401) is refreshed and retried once', async () => {
  let calls = 0
  const fakeFetch = async (url) => {
    if (String(url).includes('/oauth2/token')) return new Response(JSON.stringify({ access_token: `t${++calls}`, expires_in: 3600 }), { status: 200 })
    return calls < 2 ? new Response('{}', { status: 401 }) : new Response(JSON.stringify({ chapters: [{ id: 1, verses_count: 7, name_simple: 'x', name_arabic: 'y' }] }), { status: 200 })
  }
  const svc = createQuranService({ config: loadConfig({ QF_CLIENT_ID: 'a', QF_CLIENT_SECRET: 'b', QF_CACHE_SECONDS: '0' }), fetchImpl: fakeFetch })
  assert.equal((await svc.listChapters()).length, 1)
  assert.equal(calls, 2)
})

test('malformed provider data is rejected, not passed on', async () => {
  const fakeFetch = async (url) => {
    const u = String(url)
    if (u.includes('/oauth2/token')) return new Response(JSON.stringify({ access_token: 't' }), { status: 200 })
    if (u.includes('/juzs')) return new Response(JSON.stringify({ juzs: [{ juz_number: 1, verse_mapping: { 1: 'oops' } }] }), { status: 200 })
    return new Response(JSON.stringify({ chapter: { id: 1, verses_count: 1 } }), { status: 200 })
  }
  const svc = createQuranService({ config: loadConfig({ QF_CLIENT_ID: 'a', QF_CLIENT_SECRET: 'b', QF_CACHE_SECONDS: '0' }), fetchImpl: fakeFetch })
  await assert.rejects(() => svc.listJuzs(), { code: 'PROVIDER_BAD_RESPONSE' })
})

test('metadata is cached briefly when enabled, and verse text is never cached', async () => {
  let chapterCalls = 0, verseCalls = 0
  const fakeFetch = async (url) => {
    const u = String(url)
    if (u.includes('/oauth2/token')) return new Response(JSON.stringify({ access_token: 't' }), { status: 200 })
    if (u.includes('/verses/')) { verseCalls++; return new Response(JSON.stringify({ verses: [{ verse_number: 1, verse_key: '1:1', text_uthmani: 'x' }], pagination: {} }), { status: 200 }) }
    if (u.endsWith('/chapters')) { chapterCalls++; return new Response(JSON.stringify({ chapters: [{ id: 1, verses_count: 1 }] }), { status: 200 }) }
    return new Response(JSON.stringify({ chapter: { id: 1, verses_count: 1 } }), { status: 200 })
  }
  const svc = createQuranService({ config: loadConfig({ QF_CLIENT_ID: 'a', QF_CLIENT_SECRET: 'b', QF_CACHE_SECONDS: '600' }), fetchImpl: fakeFetch })
  await svc.listChapters(); await svc.listChapters()
  assert.equal(chapterCalls, 1)
  await svc.getVerses(1, 1, 1); await svc.getVerses(1, 1, 1)
  assert.equal(verseCalls, 2)
})

test('unknown API route is a JSON 404 and status reports the database', async () => {
  assert.equal((await get('/api/nope')).status, 404)
  assert.equal((await get('/api/status')).body.quran.configured, true)
})
