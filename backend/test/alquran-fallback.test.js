// The second Qur'an source and the combined service. Uses a FAKE AlQuran.cloud (placeholder text, not Qur'an), shaped
// like its published OpenAPI spec. The real API was not reachable when this was written: verify with check-quran-coverage.js.
import test from 'node:test'
import assert from 'node:assert/strict'
import { createAlquranCloud, createCombinedQuran, stripBasmala } from '../services/alquranCloud.js'
import { AppError } from '../utils/AppError.js'

const BASMALA = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ'
const surahs = Array.from({ length: 114 }, (_, i) => ({ number: i + 1, name: `س${i + 1}`, englishName: `Surah ${i + 1}`, englishNameTranslation: 't', numberOfAyahs: 5, revelationType: i % 2 ? 'Medinan' : 'Meccan' }))
const ok = (data) => new Response(JSON.stringify({ code: 200, status: 'OK', data }), { status: 200 })
function fake(calls = []) {
  return async (url) => {
    const p = new URL(url).pathname.replace('/v1', '')
    calls.push(p)
    if (p === '/surah') return ok(surahs)
    if (p === '/edition/format/audio') return ok([
      { identifier: 'ar.zeta', language: 'ar', type: 'versebyverse', englishName: 'Zeta' },
      { identifier: 'ar.alpha', language: 'ar', type: 'versebyverse', englishName: 'Alpha' },
      { identifier: 'en.walk', language: 'en', type: 'translation', englishName: 'English' },
    ])
    let m = /^\/surah\/(\d+)\/quran-uthmani$/.exec(p)
    if (m) {
      const n = Number(m[1])
      return ok({ ...surahs[n - 1], ayahs: [1, 2, 3, 4, 5].map((k) => ({ number: n * 10 + k, numberInSurah: k, text: k === 1 && n !== 1 && n !== 9 ? `${BASMALA} كلمة أولى` : `كلمة ${k}` })) })
    }
    m = /^\/surah\/(\d+)\/(ar\.\w+)$/.exec(p)
    if (m) return ok({ ayahs: [1, 2, 3, 4, 5].map((k) => ({ number: Number(m[1]) * 10 + k, numberInSurah: k, audio: `https://cdn.example/${m[2]}/${Number(m[1]) * 10 + k}.mp3` })) })
    m = /^\/juz\/(\d+)\/quran-uthmani$/.exec(p)
    if (m) return ok({ ayahs: [{ numberInSurah: 3, surah: { number: Number(m[1]) } }, { numberInSurah: 5, surah: { number: Number(m[1]) } }, { numberInSurah: 1, surah: { number: Number(m[1]) + 1 } }] })
    return new Response('{}', { status: 404 })
  }
}

test('basmala is removed from verse 1 only where it is not part of the verse', () => {
  assert.equal(stripBasmala(3, 1, `${BASMALA} كلمة أولى`), 'كلمة أولى')
  assert.equal(stripBasmala(1, 1, BASMALA), BASMALA) // Al-Fatihah: it IS verse 1
  assert.equal(stripBasmala(9, 1, `${BASMALA} كلمة`), `${BASMALA} كلمة`)
  assert.equal(stripBasmala(3, 2, `${BASMALA} كلمة`), `${BASMALA} كلمة`)
  assert.equal(stripBasmala(3, 1, 'كلمة أولى'), 'كلمة أولى')
})

test('lists all 114 Surahs, verses, juzs, and reciters with ids that start at 100001', async () => {
  const q = createAlquranCloud({ fetchImpl: fake() })
  assert.equal((await q.listChapters()).length, 114)
  assert.deepEqual((await q.getChapter(3)).versesCount, 5)
  const { verses } = await q.getVerses(3, 1, 2)
  assert.deepEqual(verses.map((v) => [v.verseKey, v.textUthmani]), [['3:1', 'كلمة أولى'], ['3:2', 'كلمة 2']])
  assert.equal((await q.listJuzs()).length, 30)
  assert.deepEqual((await q.listJuzs())[0].ranges, [{ surah: 1, from: 3, to: 5 }, { surah: 2, from: 1, to: 1 }])
  const rec = await q.listReciters()
  assert.deepEqual(rec.map((r) => [r.id, r.name]), [[100001, 'Alpha'], [100002, 'Zeta']])
  const audio = await q.getChapterAudio(3, 100001)
  assert.deepEqual(audio[0], { verseKey: '3:1', url: 'https://cdn.example/ar.alpha/31.mp3' })
  await assert.rejects(q.getVerses(3, 4, 9), (e) => e.code === 'INVALID_RANGE')
  await assert.rejects(q.getChapterAudio(3, 5), (e) => e.status === 404)
})

test('a failing or malformed source gives a clean error', async () => {
  const dead = createAlquranCloud({ fetchImpl: async () => { throw new Error('offline') } })
  await assert.rejects(dead.listChapters(), (e) => e instanceof AppError && e.status === 502)
  const junk = createAlquranCloud({ fetchImpl: async () => new Response('<html>', { status: 200 }) })
  await assert.rejects(junk.listChapters(), (e) => e.code === 'PROVIDER_BAD_RESPONSE')
})

test('combined: the Quran Foundation first, the second source for what it cannot serve', async () => {
  const primary = {
    configured: true, environment: 'prelive',
    listChapters: async () => surahs.slice(0, 2).map((s) => ({ id: s.number, nameSimple: 'QF', versesCount: 5 })),
    getChapter: async (id) => { if (id > 2) throw new AppError('NOT_FOUND', 'x', 404); return { id, nameSimple: 'QF', versesCount: 5 } },
    getVerses: async (id) => { if (id > 2) throw new AppError('NOT_FOUND', 'x', 404); return { chapter: { id }, verses: [{ verseKey: `${id}:1`, verseNumber: 1, textUthmani: 'QF' }] } },
    listJuzs: async () => [{ juz: 1, ranges: [] }],
    listReciters: async () => [{ id: 7, name: 'QF reciter', style: null }],
    getChapterAudio: async (id, r) => { if (id > 2) throw new AppError('CONTENT_UNAVAILABLE', 'x', 404); return [{ verseKey: `${id}:1`, url: 'qf' }] },
  }
  const q = createCombinedQuran({ primary, fallback: createAlquranCloud({ fetchImpl: fake() }) })
  assert.equal((await q.listChapters()).length, 114)
  assert.equal((await q.getVerses(1)).verses[0].textUthmani, 'QF')
  assert.equal((await q.getVerses(50, 1, 2)).verses[1].textUthmani, 'كلمة 2')
  assert.equal((await q.getChapter(114)).versesCount, 5)
  assert.equal((await q.listJuzs()).length, 30) // the primary had 1, so the second source is used
  assert.deepEqual((await q.listReciters()).map((r) => r.id), [7, 100001, 100002])
  assert.equal((await q.getChapterAudio(1, 7))[0].url, 'qf')
  assert.equal((await q.getChapterAudio(50, 100002))[0].url, 'https://cdn.example/ar.zeta/501.mp3')
  await assert.rejects(q.getVerses(50, 4, 9), (e) => e.code === 'INVALID_RANGE')
})

test('combined: a Surah neither source has is still an error, not an invented answer', async () => {
  const primary = { configured: true, environment: 'x', getChapter: async () => { throw new AppError('NOT_FOUND', 'primary', 404) } }
  const q = createCombinedQuran({ primary, fallback: createAlquranCloud({ fetchImpl: async () => new Response('{}', { status: 404 }) }) })
  await assert.rejects(q.getChapter(3), (e) => e.message === 'primary')
})
