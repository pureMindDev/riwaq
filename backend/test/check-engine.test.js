// scripts/check-engine.js had two broken imports that no test noticed, because nothing imported it.
// This test imports and runs it end-to-end against the mock provider and the stub engine.
import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { startStack } from './helpers.js'
import { runCheck } from '../scripts/check-engine.js'

let s
before(async () => { s = await startStack({ db: false, engine: true }) })
after(() => s.close())

test('check-engine script loads and scores engine output against the reference text', async () => {
  const { verses } = await s.services.quran.getVerses(1, 1, 3)
  const textByKey = new Map(verses.map((v) => [v.verseKey, v.textUthmani]))
  // The stub engine treats the audio bytes as the transcript, so "audio" = what was recited.
  const fetchImpl = async (url, wrong) => {
    const key = `1:${/_(\d+)\.wav$/.exec(url)[1]}`
    const text = wrong === key ? 'كلمة غريبة تماما' : textByKey.get(key)
    return new Response(text, { status: 200, headers: { 'content-type': 'audio/mpeg' } })
  }
  const lines = []
  const good = await runCheck({ quran: s.services.quran, engine: s.services.engine, surah: 1, from: 1, to: 3, reciterId: 901, fetchImpl, log: (l) => lines.push(l) })
  assert.equal(good.rows.length, 3)
  assert.ok(good.words > 0)
  assert.equal(good.correct, good.words)
  assert.equal(good.ratio, 1)
  assert.equal(lines.length, 3)

  const bad = await runCheck({ quran: s.services.quran, engine: s.services.engine, surah: 1, from: 1, to: 3, reciterId: 901, fetchImpl: (u) => fetchImpl(u, '1:2'), log: () => {} })
  assert.ok(bad.ratio < 1, 'a wrongly recited verse must lower the score')
})

test('check-engine reports a verse whose audio download fails instead of crashing', async () => {
  const fetchImpl = async () => new Response('nope', { status: 503 })
  const out = await runCheck({ quran: s.services.quran, engine: s.services.engine, surah: 1, from: 1, to: 3, reciterId: 901, fetchImpl, log: () => {} })
  assert.deepEqual(out.rows.map((r) => r.error), ['audio HTTP 503', 'audio HTTP 503', 'audio HTTP 503'])
  assert.equal(out.ratio, 0)
})
