import test from 'node:test'
import assert from 'node:assert/strict'
import { judgeLetter, syllableFor, key, ARABIC_NAMES } from './letterCheck.js'

const L = (id, char) => ({ id, char })
const ba = L('ba', 'ب'), ta = L('ta', 'ت'), alif = L('alif', 'ا'), ha = L('ha', 'ه'), hha = L('hha', 'ح')

test('the bare letter, letter + ā, or its Arabic name count as a match (diacritics ignored)', () => {
  for (const heard of ['ب', 'بَ', 'با', 'باء', 'با', ' ب ']) assert.equal(judgeLetter(ba, [heard]).result, 'match', heard)
})
test('a different letter or a longer word is a miss, and the learner is told what was heard', () => {
  assert.deepEqual(judgeLetter(ba, ['ت']), { result: 'miss', heard: 'ت' })
  assert.equal(judgeLetter(ba, ['بيت']).result, 'miss')
  assert.equal(judgeLetter(ba, ['بي']).result, 'miss') // a different vowel is not accepted
  assert.equal(judgeLetter(ta, ['ب']).result, 'miss')
  assert.equal(judgeLetter(ha, ['ح']).result, 'miss')
  assert.equal(judgeLetter(hha, ['ه']).result, 'miss')
})
test('any alternative may match; no speech means none', () => {
  assert.equal(judgeLetter(ba, ['كتاب', 'با']).result, 'match')
  assert.equal(judgeLetter(ba, []).result, 'none')
  assert.equal(judgeLetter(ba, ['  ', '']).result, 'none')
  assert.equal(judgeLetter(ba, ['hello']).result, 'none') // non-Arabic output carries nothing to compare
})
test('alif accepts alif, hamza+ā and its name', () => {
  for (const heard of ['ا', 'أ', 'ألف', 'آ']) assert.equal(judgeLetter(alif, [heard]).result, 'match', heard)
  assert.equal(judgeLetter(alif, ['ب']).result, 'miss')
})
test('Tajweed-style target is the letter with fatha; alif is hamza with fatha', () => {
  assert.equal(syllableFor(ba), 'بَ')
  assert.equal(syllableFor(alif), 'أَ')
  assert.equal(key('بَّ'), 'ب')
})
test('all 28 letters have an Arabic name', () => assert.equal(Object.keys(ARABIC_NAMES).length, 28))
