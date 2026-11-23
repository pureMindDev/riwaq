// Second Qur'an source: the free AlQuran.cloud API of Islamic Network (https://alquran.cloud/api), used ONLY for what the
// Quran Foundation account cannot serve (the prelive account serves just Surahs 1 and 2). Text: Tanzil-based "quran-uthmani".
// Terms (https://alquran.cloud/terms-and-conditions, read 2026-11-23): free; text may be used and shown unaltered with credit;
// recitations may be streamed for personal and educational use and remain the reciters' copyright (a reciter may ask for
// removal in a commercial product). Riwaq is free, so this is within those terms; if it ever becomes commercial, re-read them.
//
// UNVERIFIED FROM THE BUILD SANDBOX (the API was unreachable there): the response shapes follow the published OpenAPI spec
// (text) and long-standing behaviour (an `audio` URL on each ayah of an audio edition). Run
//   node --env-file=.env scripts/check-quran-coverage.js <reciterId> --audio
// to verify on a real connection.
import { AppError } from '../utils/AppError.js'

const BASE_ID = 100001 // reciter ids from this source start here so they never clash with the Quran Foundation ids
const CDN = 'https://cdn.islamic.network/quran/audio/128'
const CACHE_MS = 60 * 60 * 1000

const STRIP = /[^ء-ؿف-يٱ]/g // letters only: no vowel marks, no tatweel (U+0640)
const norm = (w) => w.replace(STRIP, '').replace(/ٱ/g, 'ا')
const BASMALA = ['بسم', 'الله', 'الرحمن', 'الرحيم']

// The "quran-uthmani" edition puts the Basmala in front of verse 1 of every Surah except 1 and 9. It is not part of the verse.
export function stripBasmala(surah, numberInSurah, text) {
  if (numberInSurah !== 1 || surah === 1 || surah === 9) return text
  const words = text.trim().split(/\s+/)
  if (words.length > 4 && BASMALA.every((b, i) => norm(words[i]) === b)) return words.slice(4).join(' ')
  return text
}

export function createAlquranCloud({ apiUrl = 'https://api.alquran.cloud/v1', fetchImpl = fetch, timeoutMs = 20000, now = Date.now } = {}) {
  const cache = new Map()
  const bad = () => new AppError('PROVIDER_BAD_RESPONSE', 'Unexpected response from the second Qur\'an source.', 502)

  async function get(path) {
    let res
    try { res = await fetchImpl(`${apiUrl}${path}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) }) }
    catch { throw new AppError('PROVIDER_ERROR', "The second Qur'an source could not be reached.", 502) }
    if (res.status === 404) throw new AppError('NOT_FOUND', 'The source has no data for this request.', 404)
    if (res.status === 429) throw new AppError('PROVIDER_RATE_LIMITED', "The Qur'an source is busy. Please try again shortly.", 503)
    if (!res.ok) throw new AppError('PROVIDER_ERROR', "The second Qur'an source had a problem.", 502)
    let json
    try { json = await res.json() } catch { throw bad() }
    if (!json || json.code !== 200 || json.data === undefined) throw bad()
    return json.data
  }
  const cached = async (key, load) => {
    const hit = cache.get(key)
    if (hit && hit.at > now() - CACHE_MS) return hit.value
    const value = await load()
    cache.set(key, { at: now(), value })
    return value
  }

  const toChapter = (c) => {
    if (!c || typeof c.number !== 'number' || typeof c.numberOfAyahs !== 'number') throw bad()
    return {
      id: c.number, nameSimple: c.englishName, nameArabic: c.name, translatedName: c.englishNameTranslation ?? null,
      versesCount: c.numberOfAyahs, revelationPlace: c.revelationType === 'Meccan' ? 'makkah' : c.revelationType === 'Medinan' ? 'madinah' : null,
    }
  }

  async function editions() {
    return cached('editions', async () => {
      const data = await get('/edition/format/audio')
      if (!Array.isArray(data)) throw bad()
      const list = data.filter((e) => e && e.language === 'ar' && e.type === 'versebyverse' && typeof e.identifier === 'string')
        .sort((a, b) => a.identifier.localeCompare(b.identifier))
      return list.map((e, i) => ({ id: BASE_ID + i, identifier: e.identifier, name: e.englishName || e.name, style: null }))
    })
  }

  const service = {
    configured: true,
    environment: 'alquran.cloud',

    listChapters: () => cached('chapters', async () => {
      const data = await get('/surah')
      if (!Array.isArray(data)) throw bad()
      return data.map(toChapter)
    }),

    async getChapter(id) {
      const found = (await service.listChapters()).find((c) => c.id === id)
      if (!found) throw new AppError('NOT_FOUND', 'The source has no data for this request.', 404)
      return found
    },

    async getVerses(chapterId, from, to) {
      const chapter = await service.getChapter(chapterId)
      const start = from ?? 1
      const end = to ?? chapter.versesCount
      if (start > end || end > chapter.versesCount) throw new AppError('INVALID_RANGE', `This Surah has ${chapter.versesCount} verses.`, 400)
      const all = await cached(`verses:${chapterId}`, async () => {
        const data = await get(`/surah/${chapterId}/quran-uthmani`)
        if (!data || !Array.isArray(data.ayahs)) throw bad()
        return data.ayahs.map((a) => {
          if (typeof a.numberInSurah !== 'number' || typeof a.text !== 'string') throw bad()
          return { verseKey: `${chapterId}:${a.numberInSurah}`, verseNumber: a.numberInSurah, textUthmani: stripBasmala(chapterId, a.numberInSurah, a.text) }
        }).sort((a, b) => a.verseNumber - b.verseNumber)
      })
      const verses = all.filter((v) => v.verseNumber >= start && v.verseNumber <= end)
      if (verses.length !== end - start + 1) throw new AppError('CONTENT_INCOMPLETE', 'The source returned an incomplete set of verses.', 502)
      return { chapter, verses }
    },

    // Which verses belong to each Juz, built from the per-Juz listing (30 requests, cached).
    listJuzs: () => cached('juzs', async () => {
      const out = []
      for (let j = 1; j <= 30; j++) {
        const data = await get(`/juz/${j}/quran-uthmani`)
        if (!data || !Array.isArray(data.ayahs)) throw bad()
        const bySurah = new Map()
        for (const a of data.ayahs) {
          const s = a.surah?.number
          if (typeof s !== 'number' || typeof a.numberInSurah !== 'number') throw bad()
          const r = bySurah.get(s) || { surah: s, from: a.numberInSurah, to: a.numberInSurah }
          r.from = Math.min(r.from, a.numberInSurah); r.to = Math.max(r.to, a.numberInSurah)
          bySurah.set(s, r)
        }
        out.push({ juz: j, ranges: [...bySurah.values()].sort((a, b) => a.surah - b.surah) })
      }
      return out
    }),

    listReciters: async () => (await editions()).map(({ id, name, style }) => ({ id, name, style })),

    async getChapterAudio(chapterId, reciterId) {
      const ed = (await editions()).find((e) => e.id === reciterId)
      if (!ed) throw new AppError('NOT_FOUND', 'Unknown reciter.', 404)
      const data = await get(`/surah/${chapterId}/${ed.identifier}`)
      if (!data || !Array.isArray(data.ayahs) || data.ayahs.length === 0) throw new AppError('CONTENT_UNAVAILABLE', 'No audio is available for this Surah and reciter.', 404)
      return data.ayahs.map((a) => {
        if (typeof a.numberInSurah !== 'number') throw bad()
        const url = typeof a.audio === 'string' && a.audio.startsWith('https://') ? a.audio : typeof a.number === 'number' ? `${CDN}/${ed.identifier}/${a.number}.mp3` : null
        if (!url) throw bad()
        return { verseKey: `${chapterId}:${a.numberInSurah}`, url }
      })
    },
  }
  return service
}

export const FALLBACK_RECITER_BASE = BASE_ID

// Use the Quran Foundation first (its text is the reference); fall back to the second source for what it cannot serve.
export function createCombinedQuran({ primary, fallback }) {
  const missing = new Set() // Surahs the primary has already failed to serve
  const failover = (e) => !(e instanceof AppError) || e.status !== 400
  async function either(id, call) {
    if (!missing.has(id)) {
      try { return await call(primary) } catch (e) {
        if (!failover(e)) throw e
        try { const r = await call(fallback); missing.add(id); return r } catch (e2) {
          console.warn(`[quran] Surah ${id}: Quran Foundation said "${e.message}", second source said "${e2.message}"`)
          throw e
        }
      }
    }
    return call(fallback)
  }
  return {
    ...primary,
    configured: primary.configured || Boolean(fallback),
    environment: primary.environment,
    fallbackSource: 'alquran.cloud',
    async listChapters() {
      let first = null
      try { first = await primary.listChapters() } catch { /* use the fallback */ }
      if (first && first.length >= 114) return first
      try { return await fallback.listChapters() } catch (e) {
        console.warn(`[quran] second source (alquran.cloud) failed: ${e.code || ''} ${e.message}. Showing only ${first ? first.length : 0} Surahs.`)
        if (first) return first
        throw e
      }
    },
    getChapter: (id) => either(id, (q) => q.getChapter(id)),
    getVerses: (id, from, to) => either(id, (q) => q.getVerses(id, from, to)),
    async listJuzs() {
      try { const j = await primary.listJuzs(); if (j.length === 30) return j } catch { /* fall back */ }
      return fallback.listJuzs()
    },
    async listReciters() {
      let a = []
      try { a = await primary.listReciters() } catch { /* the second source may still have some */ }
      let b = []
      try { b = await fallback.listReciters() } catch { /* ignore */ }
      if (!a.length && !b.length) return primary.listReciters()
      return [...a, ...b]
    },
    getChapterAudio: (id, reciter) => (reciter >= BASE_ID ? fallback.getChapterAudio(id, reciter) : primary.getChapterAudio(id, reciter)),
  }
}
