// Validates public/audio/letters/manifest.json against the real files and the curriculum's 28 letters.
//   npm run check:audio            report what is listed / missing; fail on any error
//   npm run check:audio -- --all   also fail if any letter has no recording
// It cannot hear the audio: "verifiedBy" records which qualified person confirmed each recording is the right letter.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, extname, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const DEFAULT_DIR = join(here, '../public/audio/letters')

export function sniff(buf) {
  if (buf.length >= 3 && buf.toString('latin1', 0, 3) === 'ID3') return 'mp3'
  if (buf.length >= 2 && buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0) return 'mp3'
  if (buf.length >= 12 && buf.toString('latin1', 4, 8) === 'ftyp') return 'm4a'
  return null
}

export function checkLetterAudio({ dir = DEFAULT_DIR, letters }) {
  const errors = [], warnings = []
  const ids = letters.map((l) => l.id)
  const ok = [] // letters with a valid recording
  let manifest = {}
  try { manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) } catch (e) { errors.push(`manifest.json cannot be read: ${e.message}`) }
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) { errors.push('manifest.json must be an object of letter id -> recording'); manifest = {} }

  const seenFile = new Map(), seenHash = new Map()
  for (const [id, entry] of Object.entries(manifest)) {
    if (!ids.includes(id)) { errors.push(`"${id}" is not a letter id in the curriculum`); continue }
    const file = typeof entry === 'string' ? entry : entry?.file
    if (typeof file !== 'string' || !/^[\w.-]+$/.test(file)) { errors.push(`${id}: invalid file name`); continue }
    if (!['.mp3', '.m4a'].includes(extname(file).toLowerCase())) { errors.push(`${id}: ${file} must be .mp3 or .m4a (OGG/WAV are not safe on every phone)`); continue }
    const path = join(dir, file)
    if (!existsSync(path)) { errors.push(`${id}: ${file} is listed but the file does not exist`); continue }
    const buf = readFileSync(path)
    if (statSync(path).size < 1024) { errors.push(`${id}: ${file} is under 1 KB, so it is not a real recording`); continue }
    if (!sniff(buf)) { errors.push(`${id}: ${file} does not look like MP3 or M4A audio`); continue }
    if (seenFile.has(file)) { errors.push(`${id} and ${seenFile.get(file)} point to the same file ${file}: each letter needs its own recording`); continue }
    seenFile.set(file, id)
    const hash = createHash('sha256').update(buf).digest('hex')
    if (seenHash.has(hash)) { errors.push(`${id}: ${file} is an identical copy of ${seenHash.get(hash).file} (${seenHash.get(hash).id}): each letter needs its own recording`); continue }
    seenHash.set(hash, { id, file })
    if (typeof entry !== 'object' || !entry.verifiedBy) warnings.push(`${id}: no "verifiedBy" recorded: nobody has confirmed this recording is the right letter`)
    ok.push(id)
  }
  const listed = new Set(Object.values(manifest).map((e) => (typeof e === 'string' ? e : e?.file)))
  for (const f of readdirSync(dir)) if (/\.(mp3|m4a)$/i.test(f) && !listed.has(f)) warnings.push(`${f} is in the folder but not listed in manifest.json`)
  const missing = ids.filter((id) => !ok.includes(id))
  return { errors, warnings, ok, missing }
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const { LETTERS } = await import('../../backend/config/foundationCurriculum.js')
  const r = checkLetterAudio({ letters: LETTERS })
  console.log(`Recordings valid: ${r.ok.length}/${LETTERS.length}`)
  if (r.ok.length) console.log('  ' + r.ok.join(', '))
  if (r.missing.length) console.log(`Missing: ${r.missing.join(', ')}`)
  r.warnings.forEach((w) => console.log('WARNING', w))
  r.errors.forEach((e) => console.log('ERROR', e))
  process.exit(r.errors.length || (process.argv.includes('--all') && r.missing.length) ? 1 : 0)
}
