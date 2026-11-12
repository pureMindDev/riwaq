// The ONLY file that talks to the Quran Foundation Content API.
// Docs: https://api-docs.quran.com/docs/quickstart/
//
// Terms note: we do not store Qur'an content. Only the OAuth token is kept
// in memory (it lasts about an hour).
import { AppError } from '../utils/AppError.js'

const USER_AGENT = 'DigitalTahfidh/0.1' // a default Python/urllib UA is blocked by the API
const PER_PAGE = 50
const TOKEN_SAFETY_MS = 60_000

export function createQuranService({ config, fetchImpl = fetch, now = Date.now }) {
  const qf = config.qf
  const configured = Boolean(qf.clientId && qf.clientSecret)
  let token = null // { value, expiresAt }

  function bad() {
    return new AppError('PROVIDER_BAD_RESPONSE', 'Unexpected response from the provider.', 502)
  }

  function guard() {
    if (!configured) {
      throw new AppError('PROVIDER_NOT_CONFIGURED', "The Qur'an provider is not configured on the server yet.", 503)
    }
  }

  async function timedFetch(url, options) {
    try {
      return await fetchImpl(url, { ...options, signal: AbortSignal.timeout(qf.timeoutMs) })
    } catch {
      throw new AppError('PROVIDER_UNREACHABLE', "Could not reach the Qur'an provider.", 502)
    }
  }

  async function getToken(force = false) {
    if (!force && token && token.expiresAt - TOKEN_SAFETY_MS > now()) return token.value
    const basic = Buffer.from(`${qf.clientId}:${qf.clientSecret}`).toString('base64')
    const res = await timedFetch(`${qf.authUrl}/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT,
      },
      body: 'grant_type=client_credentials&scope=content',
    })
    if (!res.ok) {
      throw new AppError('PROVIDER_AUTH', "The Qur'an provider rejected our credentials.", 502)
    }
    let json
    try {
      json = await res.json()
    } catch {
      throw bad()
    }
    if (!json.access_token) throw bad()
    token = { value: json.access_token, expiresAt: now() + (json.expires_in || 3600) * 1000 }
    return token.value
  }

  // One authenticated GET. On 401 we fetch a fresh token and retry once.
  async function get(path, params = {}, retried = false) {
    guard()
    const url = new URL(`${qf.apiUrl}/content/api/v4${path}`)
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))
    const accessToken = await getToken()
    const res = await timedFetch(url, {
      headers: {
        'x-auth-token': accessToken,
        'x-client-id': qf.clientId,
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
      },
    })
    if (res.status === 401 && !retried) {
      token = null
      return get(path, params, true)
    }
    if (res.status === 404) throw new AppError('NOT_FOUND', 'The provider has no data for this request.', 404)
    if (res.status === 429) throw new AppError('PROVIDER_RATE_LIMITED', 'The provider is busy. Please try again shortly.', 503)
    if (res.status === 401 || res.status === 403) {
      throw new AppError('PROVIDER_FORBIDDEN', 'The provider denied access for this request.', 502)
    }
    if (!res.ok) throw new AppError('PROVIDER_ERROR', "The Qur'an provider had a problem.", 502)
    try {
      return await res.json()
    } catch {
      throw bad()
    }
  }

  // Walks every page of a paginated list.
  async function getAllPages(path, params, listKey) {
    const all = []
    for (let page = 1; page <= 20; page++) {
      const json = await get(path, { ...params, per_page: PER_PAGE, page })
      if (!Array.isArray(json[listKey])) throw bad()
      all.push(...json[listKey])
      if (!json.pagination?.next_page) return all
    }
    throw bad()
  }

  function toChapter(c) {
    if (!c || typeof c.id !== 'number' || typeof c.verses_count !== 'number') throw bad()
    return {
      id: c.id,
      nameSimple: c.name_simple,
      nameArabic: c.name_arabic,
      translatedName: c.translated_name?.name ?? null,
      versesCount: c.verses_count,
      revelationPlace: c.revelation_place ?? null,
    }
  }

  function resolveAudioUrl(url) {
    if (typeof url !== 'string' || !url) throw bad()
    if (/^https?:\/\//i.test(url)) return url
    if (url.startsWith('//')) return `https:${url}`
    return new URL(url, qf.audioBaseUrl).toString()
  }

  // Short in-memory cache for Surah/Juz METADATA only (never verse text or audio).
  const cache = new Map()
  async function cached(key, load) {
    const ttl = (qf.metadataCacheSeconds ?? 0) * 1000
    const hit = cache.get(key)
    if (ttl > 0 && hit && hit.expires > now()) return hit.value
    const value = await load()
    if (ttl > 0) cache.set(key, { value, expires: now() + ttl })
    return value
  }

  const service = {
    configured,
    environment: qf.environment,

    listChapters: () =>
      cached('chapters', async () => {
        const json = await get('/chapters')
        if (!Array.isArray(json.chapters)) throw bad()
        return json.chapters.map(toChapter)
      }),

    getChapter: (id) =>
      cached(`chapter:${id}`, async () => {
        const json = await get(`/chapters/${id}`)
        if (!json.chapter) throw bad()
        return toChapter(json.chapter)
      }),

    // Which verses belong to each Juz: [{ juz, ranges: [{ surah, from, to }] }]
    listJuzs: () =>
      cached('juzs', async () => {
        const json = await get('/juzs')
        if (!Array.isArray(json.juzs)) throw bad()
        return json.juzs
          .map((j) => {
            if (typeof j.juz_number !== 'number' || !j.verse_mapping || typeof j.verse_mapping !== 'object') throw bad()
            const ranges = Object.entries(j.verse_mapping).map(([surah, range]) => {
              const m = /^(\d+)-(\d+)$/.exec(String(range))
              if (!m || !/^\d+$/.test(surah)) throw bad()
              return { surah: Number(surah), from: Number(m[1]), to: Number(m[2]) }
            })
            return { juz: j.juz_number, ranges: ranges.sort((a, b) => a.surah - b.surah || a.from - b.from) }
          })
          .sort((a, b) => a.juz - b.juz)
      }),

    // Returns verses in [from, to]. Never substitutes or pads missing verses.
    async getVerses(chapterId, from, to) {
      const chapter = await service.getChapter(chapterId)
      const start = from ?? 1
      const end = to ?? chapter.versesCount
      if (start > end || end > chapter.versesCount) {
        throw new AppError('INVALID_RANGE', `This Surah has ${chapter.versesCount} verses.`, 400)
      }
      const raw = await getAllPages(`/verses/by_chapter/${chapterId}`, { fields: 'text_uthmani', words: 'false' }, 'verses')
      const verses = raw
        .map((v) => {
          if (typeof v.verse_number !== 'number' || typeof v.verse_key !== 'string' || typeof v.text_uthmani !== 'string') {
            throw bad()
          }
          return { verseKey: v.verse_key, verseNumber: v.verse_number, textUthmani: v.text_uthmani }
        })
        .filter((v) => v.verseNumber >= start && v.verseNumber <= end)
        .sort((a, b) => a.verseNumber - b.verseNumber)
      if (verses.length === 0) {
        throw new AppError('CONTENT_UNAVAILABLE', 'The provider has no text for this Surah in the current environment.', 404)
      }
      if (verses.length !== end - start + 1) {
        throw new AppError('CONTENT_INCOMPLETE', 'The provider returned an incomplete set of verses.', 502)
      }
      return { chapter, verses }
    },

    async listReciters() {
      const json = await get('/resources/recitations')
      if (!Array.isArray(json.recitations)) throw bad()
      return json.recitations.map((r) => {
        if (typeof r.id !== 'number' || !r.reciter_name) throw bad()
        return { id: r.id, name: r.reciter_name, style: r.style ?? null }
      })
    },

    async getChapterAudio(chapterId, recitationId) {
      const raw = await getAllPages(`/recitations/${recitationId}/by_chapter/${chapterId}`, {}, 'audio_files')
      if (raw.length === 0) {
        throw new AppError('CONTENT_UNAVAILABLE', 'No audio is available for this Surah and reciter.', 404)
      }
      return raw.map((a) => {
        if (typeof a.verse_key !== 'string') throw bad()
        return { verseKey: a.verse_key, url: resolveAudioUrl(a.url) }
      })
    },
  }
  return service
}
