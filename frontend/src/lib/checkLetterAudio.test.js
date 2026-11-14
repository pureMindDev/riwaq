// Tests the manifest validator with throw-away fixture files (never shipped; they are fake audio only to exercise the checks).
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkLetterAudio } from '../../scripts/check-letter-audio.mjs'

const letters = [{ id: 'alif' }, { id: 'ba' }, { id: 'ta' }]
const mp3 = (seed) => Buffer.concat([Buffer.from('ID3'), Buffer.alloc(2000, seed)])
function fixture(manifest, files) {
  const dir = mkdtempSync(join(tmpdir(), 'letters-'))
  writeFileSync(join(dir, 'manifest.json'), JSON.stringify(manifest))
  for (const [n, b] of Object.entries(files)) writeFileSync(join(dir, n), b)
  return dir
}
const run = (m, f) => { const dir = fixture(m, f); try { return checkLetterAudio({ dir, letters }) } finally { rmSync(dir, { recursive: true }) } }

test('empty manifest: no errors, every letter reported missing', () => {
  const r = run({}, {})
  assert.deepEqual([r.errors, r.ok, r.missing], [[], [], ['alif', 'ba', 'ta']])
})
test('valid recordings are accepted; a missing "verifiedBy" is flagged as unverified', () => {
  const r = run({ alif: { file: 'alif.mp3', verifiedBy: 'Ustadh X' }, ba: 'ba.mp3' }, { 'alif.mp3': mp3(1), 'ba.mp3': mp3(2) })
  assert.deepEqual([r.errors, r.ok, r.missing], [[], ['alif', 'ba'], ['ta']])
  assert.equal(r.warnings.length, 1)
  assert.match(r.warnings[0], /^ba: no "verifiedBy"/)
})
test('rejects unknown letters, missing files, wrong types, tiny files and non-audio', () => {
  const r = run({ zzz: 'a.mp3', alif: 'gone.mp3', ba: 'ba.wav', ta: 'ta.mp3' }, { 'ba.wav': mp3(1), 'ta.mp3': Buffer.from('hello') })
  assert.equal(r.errors.length, 4)
  assert.deepEqual(r.ok, [])
})
test('non-audio bytes of a normal size are rejected', () => {
  const r = run({ alif: 'alif.mp3' }, { 'alif.mp3': Buffer.alloc(3000, 65) })
  assert.match(r.errors[0], /does not look like MP3 or M4A/)
})
test('one recording cannot serve two letters, by file name or by identical content', () => {
  let r = run({ alif: 'x.mp3', ba: 'x.mp3' }, { 'x.mp3': mp3(1) })
  assert.match(r.errors[0], /same file/)
  r = run({ alif: 'a.mp3', ba: 'b.mp3' }, { 'a.mp3': mp3(1), 'b.mp3': mp3(1) })
  assert.match(r.errors[0], /identical copy/)
  assert.deepEqual(r.ok, ['alif'])
})
test('path tricks in file names are rejected', () => {
  const r = run({ alif: '../secret.mp3' }, {})
  assert.match(r.errors[0], /invalid file name/)
})
