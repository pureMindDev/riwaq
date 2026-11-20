// Replace (or add) ONE letter's recording from a file you have, with the licence/credit bookkeeping done for you.
//
//   npm run import:audio -- <letterId> <audio file> --reader "Name" --licence "CC0" --source "https://…" \
//        [--reader-type "qualified Qur'an teacher"] [--verified-by "Ustadh X"] [--kind "letter name"] [--force]
//
// It trims silence (keeping a short margin), levels the loudness, converts to mono AAC (.m4a), REFUSES a recording that fails
// the quality check (see lib/audioMetrics.mjs) unless --force, then updates manifest.json and CREDITS.txt.
// Only import recordings you have the right to use: your own, a teacher's who agreed in writing, or an openly licensed
// one. Never synthesised speech. `--verified-by` is for a qualified person who LISTENED and confirmed the letter and makhraj.
import { readFileSync, writeFileSync, existsSync, renameSync, rmSync } from 'node:fs'
import { join, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { assessFile, ffmpegAvailable } from './lib/audioMetrics.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const opt = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined }
const positional = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && args[i - 1] !== '--force'))
const fail = (m) => { console.error(`Error: ${m}`); process.exit(1) }

const [letterId, input] = positional
const dir = opt('dir') || join(here, '../public/audio/letters')
const force = args.includes('--force')
if (!letterId || !input) fail('usage: npm run import:audio -- <letterId> <audio file> --reader "Name" --licence "CC0" --source "https://…" [--reader-type …] [--verified-by …] [--force]')
const { LETTERS } = await import('../../backend/config/foundationCurriculum.js')
if (!LETTERS.some((l) => l.id === letterId)) fail(`"${letterId}" is not a letter id. Use one of: ${LETTERS.map((l) => l.id).join(', ')}`)
if (!existsSync(input)) fail(`file not found: ${input}`)
for (const need of ['reader', 'licence', 'source']) if (!opt(need)) fail(`--${need} is required (it is how the recording is credited)`)
if (!ffmpegAvailable()) fail('ffmpeg is not installed or not on your PATH.')

const out = join(dir, `${letterId}.m4a`)
const tmp = join(dir, `.${letterId}.import.m4a`)
const trim = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.1'
const r = spawnSync('ffmpeg', ['-nostdin', '-y', '-loglevel', 'error', '-i', input, '-af', `${trim},areverse,${trim},areverse,loudnorm=I=-18:TP=-1.5:LRA=11`, '-ac', '1', '-ar', '44100', '-c:a', 'aac', '-b:a', '64k', '-f', 'ipod', tmp])
if (r.status !== 0) { rmSync(tmp, { force: true }); fail(`ffmpeg could not convert that file: ${String(r.stderr).slice(0, 300)}`) }

const q = assessFile(tmp)
console.log(`Converted: ${q.seconds.toFixed(2)} s, sound ${q.voicedSeconds.toFixed(2)} s`)
if (q.problems.length) {
  console.log(`Quality check: ${q.problems.join('; ')}`)
  if (!force) { rmSync(tmp, { force: true }); fail('this recording was NOT imported (nothing was changed). Fix the recording, or use --force if you have listened and it is fine.') }
  console.log('--force given: importing anyway.')
}
renameSync(tmp, out)

const mpath = join(dir, 'manifest.json')
const manifest = JSON.parse(readFileSync(mpath, 'utf8'))
const verifiedBy = opt('verified-by')
manifest[letterId] = {
  file: `${letterId}.m4a`,
  kind: opt('kind') || 'letter name',
  reader: opt('reader'),
  readerType: opt('reader-type') || 'not stated',
  licence: opt('licence'),
  source: opt('source'),
  originalFile: basename(input),
  ...(verifiedBy ? { verifiedBy, verification: `confirmed by ${verifiedBy}` } : { verification: 'none: NOT Tajweed-verified' }),
}
writeFileSync(mpath, JSON.stringify(manifest, null, 2) + '\n')

const cpath = join(dir, 'CREDITS.txt')
if (existsSync(cpath)) {
  const lines = readFileSync(cpath, 'utf8').split('\n')
  const i = lines.findIndex((l) => l.split('|')[1]?.trim() === `${letterId}.m4a`)
  const label = i >= 0 ? lines[i].split('|')[0].trim() : letterId
  const line = `${label} | ${letterId}.m4a | ${opt('reader')} | ${opt('licence')} | ${opt('source')}`
  if (i >= 0) lines[i] = line; else lines.push(line)
  writeFileSync(cpath, lines.join('\n'))
}
console.log(`Imported ${letterId}.m4a. manifest.json and CREDITS.txt are updated.\nNow run: npm run check:audio && npm run check:audio:quality`)
if (!verifiedBy) console.log('Note: nobody has verified this recording yet (no --verified-by). Have a qualified person listen to it.')
