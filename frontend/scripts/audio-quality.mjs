// Flags letter recordings that are broken or nearly empty (see lib/audioMetrics.mjs for exactly what is measured).
//   npm run check:audio:quality
// Needs ffmpeg. Exit code 1 when any listed recording has a problem.
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assessFile, ffmpegAvailable } from './lib/audioMetrics.mjs'

const dir = process.argv.includes('--dir') ? process.argv[process.argv.indexOf('--dir') + 1] : join(dirname(fileURLToPath(import.meta.url)), '../public/audio/letters')
if (!ffmpegAvailable()) { console.error('ffmpeg is not installed or not on your PATH.'); process.exit(2) }
const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))
let bad = 0
for (const [id, entry] of Object.entries(manifest)) {
  const file = typeof entry === 'string' ? entry : entry.file
  let r
  try { r = assessFile(join(dir, file)) } catch (e) { r = { seconds: 0, voicedSeconds: 0, problems: [e.message] } }
  const line = `${id.padEnd(6)} ${file.padEnd(10)} ${r.seconds.toFixed(2)} s, sound ${r.voicedSeconds.toFixed(2)} s`
  if (r.problems.length) { bad++; console.log(`PROBLEM ${line}\n        ${r.problems.join('; ')}`) } else console.log(`ok      ${line}`)
}
console.log(`\n${bad} of ${Object.keys(manifest).length} recordings have a problem.${bad ? ' Replace them: see scripts/import-letter-audio.mjs.' : ''}`)
console.log('This cannot hear whether the right letter is spoken or whether the makhraj is correct; that needs a qualified listener.')
process.exit(bad ? 1 : 0)
