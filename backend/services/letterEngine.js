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

export function createLetterEngine({ config, fetchImpl = fetch }) {
  const { url, key, timeoutMs } = config.letterEngine
  return {
    available: Boolean(url),
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
