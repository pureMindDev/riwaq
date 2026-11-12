// These use ordinary Arabic sentences, not Qur'anic text.
import test from 'node:test'
import assert from 'node:assert/strict'
import { alignRecitation } from '../utils/recitation/align.js'
import { splitWords, wordKey } from '../utils/recitation/normalize.js'

const ref = splitWords('الكتاب الجديد موضوع على الطاولة الكبيرة اليوم').map((text) => ({ text, verseKey: '0:1' }))
const heard = (s, conf) => splitWords(s).map((text) => ({ text, confidence: conf }))
const statuses = (r) => r.items.map((i) => i.status)

test('exact recitation is all correct and reliable', () => {
  const r = alignRecitation(ref, heard('الكتاب الجديد موضوع على الطاولة الكبيرة اليوم'))
  assert.equal(r.reliable, true)
  assert.ok(statuses(r).every((s) => s === 'correct'))
})

test('missing vowel marks and alef spelling do not count as mistakes', () => {
  assert.equal(wordKey('ٱلْكِتَـٰبُ'), wordKey('الكتب'))
  const r = alignRecitation(ref, heard('الكِتَابُ الجَدِيدُ مَوْضُوعٌ عَلَى الطَّاوِلَةِ الْكَبِيرَةِ الْيَوْمَ'))
  assert.ok(statuses(r).every((s) => s === 'correct'))
})

test('a skipped word is reported as omitted', () => {
  const r = alignRecitation(ref, heard('الكتاب الجديد على الطاولة الكبيرة اليوم'))
  assert.equal(r.items[2].status, 'omitted')
  assert.equal(r.summary.omitted, 1)
})

test('a clearly different word is reported as substituted', () => {
  const r = alignRecitation(ref, heard('الكتاب الجديد موضوع على الطاولة الصغيرة اليوم'))
  assert.equal(r.items[5].status, 'substituted')
  assert.equal(r.items[5].heard, 'الصغيرة')
})

test('an immediately repeated word is reported as repeated', () => {
  const r = alignRecitation(ref, heard('الكتاب الجديد الجديد موضوع على الطاولة الكبيرة اليوم'))
  assert.equal(r.extras.length, 1)
  assert.equal(r.extras[0].status, 'repeated')
})

test('an unrelated extra word is reported as extra', () => {
  const r = alignRecitation(ref, heard('الكتاب الجديد سيارة موضوع على الطاولة الكبيرة اليوم'))
  assert.equal(r.extras[0].status, 'extra')
})

test('stopping early marks the rest as not reached, not omitted', () => {
  const r = alignRecitation(ref, heard('الكتاب الجديد موضوع'))
  assert.deepEqual(statuses(r).slice(3), ['not_reached', 'not_reached', 'not_reached', 'not_reached'])
  assert.equal(r.summary.omitted, 0)
})

test('a near-identical word is uncertain, not a mistake', () => {
  const r = alignRecitation(ref, heard('الكتاب الجديد موضوع على الطاولة الكبيرة اليومم'))
  assert.equal(r.items[6].status, 'uncertain')
})

test('a different word heard with low confidence is uncertain', () => {
  const words = heard('الكتاب الجديد موضوع على الطاولة الصغيرة اليوم')
  words[5].confidence = 0.2
  const r = alignRecitation(ref, words)
  assert.equal(r.items[5].status, 'uncertain')
})

test('unrelated speech is unreliable and accuses nothing', () => {
  const r = alignRecitation(ref, heard('مرحبا بكم في هذا البرنامج الجميل'))
  assert.equal(r.reliable, false)
  assert.ok(r.items.every((i) => !['omitted', 'substituted'].includes(i.status)))
})

test('no speech heard is unreliable', () => {
  const r = alignRecitation(ref, [])
  assert.equal(r.reliable, false)
  assert.equal(r.reason, 'no_speech')
})

test('conservative mode reports every difference as "unsure", never as a likely mistake', () => {
  const r = alignRecitation(ref, heard('الكتاب الجديد على الطاولة الصغيرة اليوم سيارة'), { conservative: true })
  assert.equal(r.reliable, true)
  assert.ok(r.items.every((i) => !['omitted', 'substituted'].includes(i.status)))
  assert.ok(r.extras.every((e) => e.status === 'uncertain'))
  assert.equal(r.items.filter((i) => i.status === 'uncertain').length >= 2, true)
  assert.equal(r.items.find((i) => i.status === 'uncertain').reason, 'unvalidated_engine')
})

test('frontend copy of the aligner is identical to the backend source', async () => {
  const { readFile } = await import('node:fs/promises')
  for (const f of ['align.js', 'normalize.js']) {
    const a = await readFile(new URL(`../utils/recitation/${f}`, import.meta.url), 'utf8')
    const b = await readFile(new URL(`../../frontend/src/lib/recitation/${f}`, import.meta.url), 'utf8')
    assert.equal(a, b, `${f} differs: copy backend/utils/recitation/${f} to frontend/src/lib/recitation/`)
  }
})

test('reciting only the start of repeated text is "not reached", never "skipped"', () => {
  const rep = splitWords('الكتاب الجديد موضوع الكتاب الجديد موضوع الكتاب الجديد موضوع').map((text) => ({ text }))
  const r = alignRecitation(rep, heard('الكتاب الجديد موضوع'))
  assert.deepEqual(statuses(r), ['correct', 'correct', 'correct', ...Array(6).fill('not_reached')])
  assert.equal(r.summary.omitted, 0)
})
