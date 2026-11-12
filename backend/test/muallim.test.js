// Direct, teacher-style corrections. Uses ordinary Arabic words (NOT Qur'anic text) so the rules are tested without Qur'an content.
import test from 'node:test'
import assert from 'node:assert/strict'
import { compareWord, muallimFeedback, letterUnits } from '../utils/recitation/muallim.js'
import { alignRecitation } from '../utils/recitation/align.js'
import { splitWords } from '../utils/recitation/normalize.js'

const ref = (s) => splitWords(s).map((text) => ({ text }))
const heard = (s) => splitWords(s).map((text) => ({ text, confidence: 0.9 }))
const fb = (r, h) => muallimFeedback(alignRecitation(ref(r), heard(h)))

test('letters and vowel marks are split into units', () => {
  assert.deepEqual(letterUnits('كَتَبَ').map((u) => [u.base, u.marks[0]]), [['ك', 'fatha'], ['ت', 'fatha'], ['ب', 'fatha']])
  assert.equal(letterUnits('مُدَرِّس')[2].marks.length, 2)
})

test('same letters, wrong vowel: names the letter, the expected vowel and what was said', () => {
  assert.deepEqual(compareWord('كَتَبَ', 'كَتِبَ'), [{ type: 'vowel', letter: 'ت', position: 2, expected: 'fatha', heard: 'kasra' }])
})

test('a transcript without vowel marks cannot be used to claim a vowel mistake', () => {
  assert.deepEqual(compareWord('كَتَبَ', 'كتب'), [])
})

test('a missing sukun in the transcript is not a mistake, but a wrong vowel is', () => {
  assert.deepEqual(compareWord('مَدْرَسَة', 'مَدرَسَة'), [])
  assert.equal(compareWord('كَتَبَ', 'كَتُبَ')[0].heard, 'damma')
})

test('doubling (shadda) is checked', () => {
  assert.equal(compareWord('مُدَرِّس', 'مُدَرِس')[0].type, 'shadda')
})

test('a different letter is named, with its position (the Rahim / Ra\'im kind of mistake)', () => {
  assert.deepEqual(compareWord('الرحيم', 'الرئيم'), [{ type: 'letter', position: 4, expected: 'ح', heard: 'ئ' }])
  assert.deepEqual(compareWord('كتاب', 'قتاب'), [{ type: 'letter', position: 1, expected: 'ك', heard: 'ق' }])
})

test('missing and extra letters are named', () => {
  assert.equal(compareWord('كتاب', 'كتب')[0].type, 'letter_missing')
  assert.equal(compareWord('كتب', 'كتاب')[0].type, 'letter_extra')
})

test('feedback: a perfect recitation passes with no corrections', () => {
  const r = fb('الكتاب الجديد موضوع على الطاولة', 'الكتاب الجديد موضوع على الطاولة')
  assert.deepEqual([r.verdict, r.corrections.length], ['passed', 0])
})

test('feedback: points at the exact word and letter, in plain direct language', () => {
  const r = fb('الكتاب الجديد موضوع على الطاولة', 'الكتاب الجديد موضوع على الطازلة')
  assert.equal(r.verdict, 'try_again')
  assert.equal(r.corrections.length, 1)
  assert.match(r.corrections[0].message, /Word 5 «الطاولة»/)
  assert.match(r.corrections[0].message, /should be و .*but you said ز/)
})

test('feedback: skipped, wrong, repeated and early-stop are all stated directly', () => {
  assert.match(fb('الكتاب الجديد موضوع على الطاولة', 'الكتاب الجديد على الطاولة').corrections[0].message, /Word 3 «موضوع»: you skipped this word/)
  assert.match(fb('الكتاب الجديد موضوع على الطاولة', 'الكتاب الجديد موضوع على السيارة').corrections[0].message, /you said «السيارة»\. The word is «الطاولة»/)
  assert.match(fb('الكتاب الجديد موضوع على الطاولة', 'الكتاب الجديد الجديد موضوع على الطاولة').corrections[0].message, /you repeated «الجديد»/)
  assert.match(fb('الكتاب الجديد موضوع على الطاولة', 'الكتاب الجديد موضوع').corrections[0].message, /You stopped before word 4 «على»/)
})

test('feedback: a vowel mistake makes a word "not passed" even though the letters match', () => {
  const r = fb('كَتَبَ الطَّالِبُ', 'كَتِبَ الطَّالِبُ')
  assert.equal(r.verdict, 'try_again')
  assert.match(r.corrections[0].message, /on the letter ت \(Tā’\) the vowel should be fatḥa, but you said kasra/)
})

test('feedback: unintelligible audio is "unclear", never an accusation', () => {
  const r = fb('الكتاب الجديد موضوع على الطاولة', 'مرحبا بكم في هذا البرنامج')
  assert.equal(r.verdict, 'unclear')
  assert.deepEqual(r.corrections, [])
  assert.equal(muallimFeedback(alignRecitation(ref('الكتاب الجديد'), [])).verdict, 'unclear')
})
