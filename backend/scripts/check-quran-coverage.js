// Which Surahs and verse audio does YOUR Quran Foundation account actually serve?
//
//   node --env-file=.env scripts/check-quran-coverage.js [reciterId] [--audio]
//
// For all 114 Surahs it asks the provider for the verse text and (with --audio, needs a reciterId) the verse audio,
// and prints a table of what is missing. Run it with QF_ENV=prelive and again with QF_ENV=production to see the difference.
// Nothing is stored. The site itself never limits Surahs: it shows whatever the provider returns, and says so when a
// Surah or its audio is unavailable. (Qur'an text and audio are fetched live; this project does not store them.)
import { pathToFileURL } from 'node:url'
import { loadConfig } from '../config/index.js'
import { createQuranService } from '../services/quranFoundation.js'

export async function runCoverage({ quran, reciterId = null, log = console.log, concurrency = 4 }) {
  const chapters = await quran.listChapters()
  const rows = new Array(chapters.length)
  let next = 0
  async function worker() {
    while (next < chapters.length) {
      const i = next++
      const c = chapters[i]
      const row = { id: c.id, verses: c.versesCount, text: 'ok', audio: reciterId ? 'ok' : 'skipped' }
      try { await quran.getVerses(c.id) } catch (e) { row.text = e.code || 'error' }
      if (reciterId) {
        try {
          const files = await quran.getChapterAudio(c.id, reciterId)
          const have = new Set(files.map((f) => f.verseKey))
          const missing = []
          for (let v = 1; v <= c.versesCount; v++) if (!have.has(`${c.id}:${v}`)) missing.push(v)
          if (missing.length) row.audio = `missing ${missing.length} of ${c.versesCount}`
        } catch (e) { row.audio = e.code || 'error' }
      }
      rows[i] = row
      log(`${String(c.id).padStart(3)}  ${String(c.versesCount).padStart(3)} verses  text: ${row.text}  audio: ${row.audio}`)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, chapters.length) }, worker))
  return {
    chapters: chapters.length,
    textOk: rows.filter((r) => r.text === 'ok').length,
    audioOk: rows.filter((r) => r.audio === 'ok').length,
    textMissing: rows.filter((r) => r.text !== 'ok').map((r) => r.id),
    audioMissing: rows.filter((r) => r.audio !== 'ok' && r.audio !== 'skipped').map((r) => r.id),
    rows,
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2)
  const reciterId = Number(args.find((a) => /^\d+$/.test(a))) || null
  const config = loadConfig()
  const quran = createQuranService({ config })
  if (!quran.configured) { console.error('Set QF_CLIENT_ID and QF_CLIENT_SECRET in .env first.'); process.exit(2) }
  if (args.includes('--audio') && !reciterId) {
    const list = await quran.listReciters()
    console.log('Pass one of these reciter ids, e.g. `... check-quran-coverage.js 7 --audio`:')
    for (const r of list) console.log(`  ${r.id}  ${r.name}${r.style ? ` (${r.style})` : ''}`)
    process.exit(2)
  }
  console.log(`Environment: ${quran.environment}`)
  const out = await runCoverage({ quran, reciterId })
  console.log(`\nChapters listed: ${out.chapters} of 114. Text complete: ${out.textOk}. Audio complete: ${reciterId ? out.audioOk : 'not checked'}.`)
  if (out.chapters !== 114) console.log('The provider lists fewer than 114 chapters for this account/environment.')
  if (out.textMissing.length) console.log(`Text missing for Surahs: ${out.textMissing.join(', ')}`)
  if (out.audioMissing.length) console.log(`Audio missing for Surahs: ${out.audioMissing.join(', ')}`)
}
