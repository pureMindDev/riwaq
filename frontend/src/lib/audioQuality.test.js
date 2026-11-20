// Tests of the recording quality check and the import tool. The audio here is throw-away synthetic tones made with ffmpeg
// in a temp folder, used only to exercise the checks. It is never shipped or used as a letter recording.
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, copyFileSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { assessFile, ffmpegAvailable } from '../../scripts/lib/audioMetrics.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const real = join(here, '../../public/audio/letters')
const skip = ffmpegAvailable() ? false : 'ffmpeg is not installed'
const tmp = mkdtempSync(join(tmpdir(), 'aq-'))
test.after(() => rmSync(tmp, { recursive: true, force: true }))

function make(name, graph, inputs = ['sine=frequency=300:duration=0.6:sample_rate=16000']) {
  const path = join(tmp, name)
  const a = ['-nostdin', '-y', '-loglevel', 'error']
  for (const i of inputs) a.push('-f', 'lavfi', '-i', i)
  a.push('-filter_complex', graph, '-map', '[o]', '-ac', '1', '-ar', '16000', path)
  assert.equal(spawnSync('ffmpeg', a).status, 0, name)
  return path
}
const voice = () => make('voice.wav', '[0]afade=t=in:d=0.05,afade=t=out:st=0.5:d=0.1,volume=4[o]')
const pop = () => make('pop.wav', '[0][1]concat=n=2:v=0:a=1,volume=4[o]', ['sine=frequency=300:duration=0.04:sample_rate=16000', 'anoisesrc=d=0.7:a=0.01:r=16000'])

test('a sustained sound passes the quality check', { skip }, () => {
  const r = assessFile(voice())
  assert.deepEqual(r.problems, [])
  assert.ok(r.voicedSeconds >= 0.4)
})

test('a short pop followed by background noise (the Ba problem) is flagged', { skip }, () => {
  const r = assessFile(pop())
  assert.equal(r.problems.length, 1)
  assert.match(r.problems[0], /pop with no vowel/)
})

test('silence, over-long and clipped recordings are flagged', { skip }, () => {
  assert.match(assessFile(make('quiet.wav', '[0]volume=0.0001[o]')).problems[0], /almost silent/)
  assert.match(assessFile(make('long.wav', '[0]volume=4[o]', ['sine=frequency=300:duration=5:sample_rate=16000'])).problems.join(), /long/)
  assert.match(assessFile(make('clip.wav', '[0]volume=30[o]')).problems.join(), /clipped/)
})

function sandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'aq-dir-'))
  for (const f of ['manifest.json', 'CREDITS.txt', 'ba.m4a']) copyFileSync(join(real, f), join(dir, f))
  return dir
}
const run = (extra, dir) => spawnSync('node', [join(here, '../../scripts/import-letter-audio.mjs'), ...extra, '--dir', dir], { encoding: 'utf8' })
const OPTS = ['--reader', 'Test Reader', '--licence', 'CC0', '--source', 'https://example.org/x', '--reader-type', 'test']

test('import: a good recording replaces the letter, is converted to .m4a and the credits are updated', { skip }, () => {
  const dir = sandbox()
  try {
    const r = run(['ba', voice(), ...OPTS, '--verified-by', 'Ustadh Test'], dir)
    assert.equal(r.status, 0, r.stdout + r.stderr)
    const m = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))
    assert.deepEqual([m.ba.file, m.ba.reader, m.ba.licence, m.ba.source, m.ba.verifiedBy], ['ba.m4a', 'Test Reader', 'CC0', 'https://example.org/x', 'Ustadh Test'])
    assert.ok(m.alif.reader, 'other letters are untouched')
    const credits = readFileSync(join(dir, 'CREDITS.txt'), 'utf8')
    assert.match(credits, /^B.* \| ba\.m4a \| Test Reader \| CC0 \| https:\/\/example\.org\/x$/m)
    assert.equal((credits.match(/\| ba\.m4a \|/g) || []).length, 1)
    assert.deepEqual(assessFile(join(dir, 'ba.m4a')).problems, [])
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('import: a broken recording is refused and NOTHING changes', { skip }, () => {
  const dir = sandbox()
  try {
    const before = [readFileSync(join(dir, 'manifest.json'), 'utf8'), readFileSync(join(dir, 'ba.m4a')), readFileSync(join(dir, 'CREDITS.txt'), 'utf8')]
    const r = run(['ba', pop(), ...OPTS], dir)
    assert.equal(r.status, 1)
    assert.match(r.stdout + r.stderr, /NOT imported/)
    assert.equal(readFileSync(join(dir, 'manifest.json'), 'utf8'), before[0])
    assert.ok(readFileSync(join(dir, 'ba.m4a')).equals(before[1]))
    assert.equal(readFileSync(join(dir, 'CREDITS.txt'), 'utf8'), before[2])
    assert.equal(existsSync(join(dir, '.ba.import.m4a')), false)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('import: needs a real letter id, an existing file and the credit details', { skip }, () => {
  const dir = sandbox()
  try {
    assert.equal(run(['zzz', voice(), ...OPTS], dir).status, 1)
    assert.equal(run(['ba', join(tmp, 'nope.wav'), ...OPTS], dir).status, 1)
    assert.equal(run(['ba', voice(), '--reader', 'x'], dir).status, 1) // no licence/source: it would be uncredited
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
