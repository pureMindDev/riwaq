// Arabic teaching data, checked against facts from the Unicode Character Database (which records, for each letter,
// whether it has initial/medial forms) and the standard alphabet order. No database needed.
import test from 'node:test'
import assert from 'node:assert/strict'
import { LETTERS, LESSONS, SHORT_VOWELS, OTHER_MARKS, LONG_VOWELS } from '../config/foundationCurriculum.js'
import { quizDefinition } from '../services/foundationService.js'

const cp = (s) => s.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')

test('the 28 letters are the standard Arabic letters, in alphabet order, with the correct Unicode characters', () => {
  assert.deepEqual(LETTERS.map((l) => cp(l.char)), [
    '0627', '0628', '062A', '062B', '062C', '062D', '062E', '062F', '0630', '0631', '0632', '0633', '0634', '0635',
    '0636', '0637', '0638', '0639', '063A', '0641', '0642', '0643', '0644', '0645', '0646', '0647', '0648', '064A',
  ])
  assert.equal(new Set(LETTERS.map((l) => l.id)).size, 28)
  assert.equal(new Set(LETTERS.map((l) => l.name)).size, 28, 'names must be unique (they are quiz answers)')
  for (const l of LETTERS) assert.equal([...l.char].length, 1, `${l.id} must be a single code point (no Persian variants or marks)`)
})

test('exactly six letters never connect to the next letter: alif, dal, dhal, ra, zay, waw', () => {
  const nonJoiners = LETTERS.filter((l) => !l.joins).map((l) => l.char)
  assert.deepEqual(nonJoiners, ['ا', 'د', 'ذ', 'ر', 'ز', 'و'])
})

test('lesson titles match the letters they teach, and every letter is taught exactly once', () => {
  const taught = LESSONS.filter((l) => l.type === 'letters').flatMap((l) => l.letterIds)
  assert.deepEqual(taught, LETTERS.map((l) => l.id))
  const byId = Object.fromEntries(LETTERS.map((l) => [l.id, l]))
  const first = (l) => byId[l.letterIds[0]].name
  const last = (l) => byId[l.letterIds.at(-1)].name
  for (const l of LESSONS.filter((x) => x.type === 'letters')) {
    const [, from, to] = /: (.+) to (.+)$/.exec(l.title)
    assert.deepEqual([first(l), last(l)], [from, to], l.title)
  }
})

test('diacritics are the right Unicode marks with the right sounds', () => {
  const m = Object.fromEntries([...SHORT_VOWELS, ...OTHER_MARKS].map((x) => [x.id, x]))
  assert.deepEqual(Object.fromEntries(Object.entries(m).map(([k, v]) => [k, cp(v.mark)])), {
    fatha: '064E', kasra: '0650', damma: '064F', sukun: '0652', shadda: '0651', fathatan: '064B', kasratan: '064D', dammatan: '064C',
  })
  assert.deepEqual(SHORT_VOWELS.map((v) => v.vowel), ['a', 'i', 'u'])
  assert.match(m.fathatan.meaning, /-an/); assert.match(m.kasratan.meaning, /-in/); assert.match(m.dammatan.meaning, /-un/)
  // long vowels: fatha+alif, kasra+ya, damma+waw
  assert.deepEqual(LONG_VOWELS.map((v) => [...v.pattern('ب')].slice(1).map(cp).join('+')), ['064E+0627', '0650+064A', '064F+0648'])
})

test('every letters quiz has the right answer among its choices and no duplicate choices', () => {
  for (const l of LESSONS.filter((x) => x.type === 'letters')) {
    for (const q of quizDefinition(l.id)) {
      assert.ok(q.pool.includes(q.answer))
      assert.equal(new Set(q.pool).size, q.pool.length)
    }
  }
})

test('every letter has a makhraj in a known articulation area, consistent with the area table', async () => {
  const { MAKHRAJ, ARTICULATION_AREAS, LETTERS } = await import('../config/foundationCurriculum.js')
  assert.deepEqual(Object.keys(MAKHRAJ), LETTERS.map((l) => l.id))
  for (const l of LETTERS) {
    const m = MAKHRAJ[l.id]
    const area = ARTICULATION_AREAS.find((a) => a.name === m.area)
    assert.ok(area, `${l.id}: unknown area`)
    assert.ok(area.letters.split(' ').includes(l.char), `${l.id}: ${l.char} is not listed in "${area.name}"`)
    assert.ok(m.place.length > 20)
  }
  // Throat letters: the three sub-places agree with the area table's note (deepest ء ه, middle ع ح, nearest the mouth غ خ).
  assert.ok(MAKHRAJ.ha.place.includes('deepest') && MAKHRAJ.ayn.place.includes('middle') && MAKHRAJ.hha.place.includes('middle') && MAKHRAJ.kha.place.includes('top') && MAKHRAJ.ghayn.place.includes('top'))
})
