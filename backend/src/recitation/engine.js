// Adapter for an external Qur'an speech-recognition service.
//
// Contract (what our code expects the service to do):
//   POST <RECITATION_ENGINE_URL>   body = raw audio bytes, Content-Type = audio type
//   -> 200 JSON { "words": [ { "text": "...", "confidence": 0.0-1.0 (optional) } ] }
//
// No engine ships with this project. See docs/RECITATION.md.
import { AppError } from '../errors.js'

export function createRecitationEngine({ config, fetchImpl = fetch }) {
  const { engineUrl, timeoutMs } = config.recitation
  return {
    available: Boolean(engineUrl),
    async transcribe(audio, contentType) {
      if (!engineUrl) {
        throw new AppError('RECITATION_ENGINE_NOT_CONFIGURED', 'Recitation analysis is not available yet.', 501)
      }
      let res
      try {
        res = await fetchImpl(engineUrl, {
          method: 'POST',
          headers: { 'Content-Type': contentType },
          body: audio,
          signal: AbortSignal.timeout(timeoutMs),
        })
      } catch {
        throw new AppError('RECITATION_ENGINE_UNREACHABLE', 'The recitation service could not be reached.', 502)
      }
      if (!res.ok) throw new AppError('RECITATION_ENGINE_ERROR', 'The recitation service had a problem.', 502)
      let json
      try {
        json = await res.json()
      } catch {
        throw new AppError('RECITATION_ENGINE_BAD_RESPONSE', 'Unexpected response from the recitation service.', 502)
      }
      if (!Array.isArray(json.words) || json.words.some((w) => typeof w.text !== 'string')) {
        throw new AppError('RECITATION_ENGINE_BAD_RESPONSE', 'Unexpected response from the recitation service.', 502)
      }
      return json.words.map((w) => ({
        text: w.text,
        confidence: typeof w.confidence === 'number' ? w.confidence : undefined,
      }))
    },
  }
}
