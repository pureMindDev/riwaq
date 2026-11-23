// Adapter for the AI letter-check engine (engine/ in this repository, wrapping the Quran Muaalem model).
//
//   POST <LETTER_ENGINE_URL>/letter?letter=<Arabic letter>   body = raw audio, header X-Engine-Key
//   -> 200 JSON { result: 'match'|'fix'|'miss'|'none', expected, heard, hints: [{message,...}], confidence? }
//
// The result is EXPERIMENTAL: the model's accuracy on real learners has not been measured (see engine/README.md).
import { AppError } from '../utils/AppError.js'
import { LETTERS } from '../config/foundationCurriculum.js'

const RESULTS = new Set(['match', 'fix', 'miss', 'none'])
const charById = new Map(LETTERS.map((l) => [l.id, l.char]))

const STATUSES = new Set(['ok', 'wrong', 'omitted', 'not_reached'])

export function createLetterEngine({ config, fetchImpl = fetch }) {
  const { url, key, timeoutMs } = config.letterEngine
  return {
    available: Boolean(url),
    // A whole passage (verses from..to of a surah): one record per word, from the engine's own bundled text.
    async checkPassage(surah, from, to, audio, contentType) {
      if (!url) throw new AppError('LETTER_ENGINE_NOT_CONFIGURED', 'The AI checker is not available yet.', 501)
      let res
      try {
        res = await fetchImpl(`${url}/recite?surah=${surah}&from=${from}&to=${to}`, {
          method: 'POST',
          headers: { 'Content-Type': contentType || 'audio/webm', ...(key ? { 'X-Engine-Key': key } : {}) },
          body: audio,
          signal: AbortSignal.timeout(Math.max(timeoutMs, 120000)),
        })
      } catch {
        throw new AppError('LETTER_ENGINE_UNREACHABLE', 'The AI checker could not be reached. Try again in a moment.', 502)
      }
      if (res.status === 400) throw new AppError('INVALID_AUDIO', 'That recording could not be used, or the verses are not valid for this surah.', 400)
      if (!res.ok) {
        const body = await res.text().catch(() => '')
        console.warn(`[engine] /recite answered HTTP ${res.status}: ${body.slice(0, 300)}`)
        const hint = res.status === 404 ? ' The engine is the old version: copy engine/recite.py and engine/server.py and restart it.' : res.status === 401 ? ' The engine key does not match LETTER_ENGINE_KEY.' : ''
        throw new AppError('LETTER_ENGINE_ERROR', `The AI checker had a problem (engine HTTP ${res.status}).${hint}`, 502)
      }
      let json
      try { json = await res.json() } catch { throw new AppError('LETTER_ENGINE_BAD_RESPONSE', 'Unexpected response from the AI checker.', 502) }
      const okWord = (w) => w && typeof w.text === 'string' && STATUSES.has(w.status) && Number.isInteger(w.aya)
      if (!json || !Array.isArray(json.words) || json.words.length === 0 || !json.words.every(okWord)) {
        throw new AppError('LETTER_ENGINE_BAD_RESPONSE', 'Unexpected response from the AI checker.', 502)
      }
      const msgs = (a) => (Array.isArray(a) ? a.filter((x) => typeof x?.message === 'string').slice(0, 5).map((x) => ({ message: x.message, rule: typeof x.rule === 'string' ? x.rule : null })) : [])
      return {
        reliable: json.reliable !== false,
        reason: typeof json.reason === 'string' ? json.reason : null,
        words: json.words.map((w) => ({
          aya: w.aya, text: w.text, status: w.status,
          problems: Array.isArray(w.problems) ? w.problems.slice(0, 6).map((p) => ({ kind: String(p.kind), span: String(p.span ?? ''), expected: String(p.expected ?? ''), heard: String(p.heard ?? '') })) : [],
          advice: msgs(w.advice),
        })),
      }
    },
    async check(letterId, audio, contentType) {
      if (!url) throw new AppError('LETTER_ENGINE_NOT_CONFIGURED', 'The AI letter check is not available yet.', 501)
      const char = charById.get(letterId)
      if (!char) throw new AppError('NOT_FOUND', 'Unknown letter.', 404)
      let res
      try {
        res = await fetchImpl(`${url}/letter?letter=${encodeURIComponent(char)}`, {
          method: 'POST',
          headers: { 'Content-Type': contentType || 'audio/webm', ...(key ? { 'X-Engine-Key': key } : {}) },
          body: audio,
          signal: AbortSignal.timeout(timeoutMs),
        })
      } catch {
        throw new AppError('LETTER_ENGINE_UNREACHABLE', 'The AI letter check could not be reached. Try again in a moment.', 502)
      }
      if (res.status === 400) throw new AppError('INVALID_AUDIO', 'That recording could not be used. Record one short letter (up to a few seconds) and try again.', 400)
      if (!res.ok) throw new AppError('LETTER_ENGINE_ERROR', 'The AI letter check had a problem.', 502)
      let json
      try { json = await res.json() } catch { throw new AppError('LETTER_ENGINE_BAD_RESPONSE', 'Unexpected response from the AI letter check.', 502) }
      if (!json || !RESULTS.has(json.result)) throw new AppError('LETTER_ENGINE_BAD_RESPONSE', 'Unexpected response from the AI letter check.', 502)
      const hints = Array.isArray(json.hints) ? json.hints.filter((h) => typeof h?.message === 'string').slice(0, 5).map((h) => ({ message: h.message })) : []
      return {
        result: json.result,
        expected: typeof json.expected === 'string' ? json.expected : undefined,
        heard: typeof json.heard === 'string' ? json.heard : '',
        hints,
        confidence: typeof json.confidence === 'number' ? json.confidence : undefined,
        experimental: true,
      }
    },
  }
}
