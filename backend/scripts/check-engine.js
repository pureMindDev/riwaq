// Calibration check for a recognition engine, using REAL reference-reciter audio.
//
//   node --env-file=.env scripts/check-engine.js <surah> <from> <to> <reciterId>
//
// It downloads the professional reciter's audio for each verse from the provider, sends it
// to the configured RECITATION_ENGINE_URL, and aligns the result with the reference text.
// Studio audio should come back almost entirely "correct". If it does not, the engine
// is not ready. Passing this does NOT prove it works on learners' phone recordings.
import { loadConfig } from '../config/index.js'
import { createQuranService } from '../services/quranFoundation.js'
import { createRecitationEngine } from '../services/recitationEngine.js'
import { splitWords } from '../utils/recitation/normalize.js'
import { alignRecitation } from '../utils/recitation/align.js'

export async function runCheck({ quran, engine, surah, from, to, reciterId, fetchImpl = fetch, log = console.log }) {
  const { verses } = await quran.getVerses(surah, from, to)
  const audio = await quran.getChapterAudio(surah, reciterId)
  const rows = []
  for (const v of verses) {
    const file = audio.find((a) => a.verseKey === v.verseKey)
    if (!file) { rows.push({ verseKey: v.verseKey, error: 'no audio' }); continue }
    const res = await fetchImpl(file.url)
    if (!res.ok) { rows.push({ verseKey: v.verseKey, error: `audio HTTP ${res.status}` }); continue }
    const bytes = Buffer.from(await res.arrayBuffer())
    const heard = await engine.transcribe(bytes, res.headers.get('content-type') || 'audio/mpeg')
    const ref = splitWords(v.textUthmani).map((text) => ({ text, verseKey: v.verseKey }))
    const result = alignRecitation(ref, heard)
    const total = ref.length
    rows.push({ verseKey: v.verseKey, words: total, correct: result.summary.correct, reliable: result.reliable })
    log(`${v.verseKey}: ${result.summary.correct}/${total} words matched${result.reliable ? '' : ' (UNRELIABLE)'}`)
  }
  const words = rows.reduce((n, r) => n + (r.words || 0), 0)
  const correct = rows.reduce((n, r) => n + (r.correct || 0), 0)
  return { rows, words, correct, ratio: words ? correct / words : 0 }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [surah, from, to, reciterId] = process.argv.slice(2).map(Number)
  if (![surah, from, to, reciterId].every(Number.isInteger)) {
    console.error('Usage: node --env-file=.env scripts/check-engine.js <surah> <from> <to> <reciterId>')
    process.exit(2)
  }
  const config = loadConfig()
  const engine = createRecitationEngine({ config })
  if (!engine.available) { console.error('Set RECITATION_ENGINE_URL first.'); process.exit(2) }
  const out = await runCheck({ quran: createQuranService({ config }), engine, surah, from, to, reciterId })
  console.log(`\nOverall: ${out.correct}/${out.words} words matched (${(out.ratio * 100).toFixed(1)}%)`)
}
