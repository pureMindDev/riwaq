// The "Muallim": turns the word-by-word comparison into direct, teacher-style corrections.
//
//   "Word 4 «الرحيم»: the 3rd letter should be ح (Ḥā’), but you said ء (hamza)."
//   "Word 2 «الرَّحِيمِ»: on the letter ر the vowel should be kasra, but you said fatha."
//
// HONESTY NOTE: a correction can only be as accurate as the recognition engine behind it.
// Letter and vowel corrections need an engine whose transcript contains the letters and vowel marks
// it actually heard. If the engine returns plain text without vowel marks, vowel mistakes cannot be heard,
// and this module does not invent them.
import { LETTERS } from '../../config/foundationCurriculum.js'
import { wordKey } from './normalize.js'

const MARKS = {
  '\u064E': 'fatha', '\u0650': 'kasra', '\u064F': 'damma',
  '\u0652': 'sukun', '\u06E1': 'sukun', '\u0651': 'shadda',
  '\u064B': 'fathatan', '\u064D': 'kasratan', '\u064C': 'dammatan',
}
const MARK_NAME = { fatha: 'fatḥa', kasra: 'kasra', damma: 'ḍamma', sukun: 'sukūn', shadda: 'shadda', fathatan: 'fatḥatān', kasratan: 'kasratān', dammatan: 'ḍammatān' }
const VOWELS = new Set(['fatha', 'kasra', 'damma', 'fathatan', 'kasratan', 'dammatan'])
const LETTER_NAME = new Map(LETTERS.map((l) => [l.char, `${l.char} (${l.name})`]))
LETTER_NAME.set('ء', 'ء (hamza)')
LETTER_NAME.set('ة', 'ة (tā’ marbūṭa)')

const baseOf = (ch) => ({ 'أ': 'ا', 'إ': 'ا', 'آ': 'ا', 'ٱ': 'ا', 'ى': 'ي' }[ch] ?? ch)
const isLetter = (ch) => /[\u0621-\u064A\u0671]/.test(ch)
const letterName = (ch) => LETTER_NAME.get(ch) || ch
const ordinal = (n) => ['1st', '2nd', '3rd'][n - 1] || `${n}th`

// "رَحِيم" -> [{ base: 'ر', marks: ['fatha'] }, ...]
export function letterUnits(word) {
  const out = []
  for (const ch of String(word).normalize('NFC')) {
    if (MARKS[ch]) out.at(-1)?.marks.push(MARKS[ch])
    else if (isLetter(ch)) out.push({ base: baseOf(ch), marks: [] })
  }
  return out
}

const vowelOf = (u) => u.marks.find((m) => VOWELS.has(m)) || null

// Compares one reference word with what was heard. Returns a list of specific problems (maybe empty).
export function compareWord(reference, heard) {
  const a = letterUnits(reference)
  const b = letterUnits(heard)
  const problems = []

  if (a.length === b.length && a.every((u, i) => u.base === b[i].base)) {
    // Same letters: only vowels can differ, and only if the engine actually transcribed vowels.
    const heardHasVowels = b.some((u) => vowelOf(u) || u.marks.includes('shadda'))
    if (!heardHasVowels) return problems
    a.forEach((u, i) => {
      const want = vowelOf(u), got = vowelOf(b[i])
      if (want && got && want !== got) problems.push({ type: 'vowel', letter: u.base, position: i + 1, expected: want, heard: got })
      else if (want && !got && !b[i].marks.includes('sukun')) problems.push({ type: 'vowel', letter: u.base, position: i + 1, expected: want, heard: null })
      if (u.marks.includes('shadda') && !b[i].marks.includes('shadda')) problems.push({ type: 'shadda', letter: u.base, position: i + 1 })
      if (!u.marks.includes('shadda') && b[i].marks.includes('shadda')) problems.push({ type: 'shadda_extra', letter: u.base, position: i + 1 })
    })
    return problems
  }

  // Different letters: find the smallest edit that explains the difference.
  const x = a.map((u) => u.base), y = b.map((u) => u.base)
  if (Math.abs(x.length - y.length) > 1) return problems
  if (x.length === y.length) {
    const diffs = x.map((c, i) => [c, y[i], i + 1]).filter(([p, q]) => p !== q)
    if (diffs.length > 0 && diffs.length <= 2) {
      for (const [want, got, pos] of diffs) problems.push({ type: 'letter', position: pos, expected: want, heard: got })
    }
  } else if (x.length > y.length) {
    const i = x.findIndex((c, k) => c !== y[k])
    const at = i === -1 ? x.length - 1 : i
    if (x.filter((_, k) => k !== at).join('') === y.join('')) problems.push({ type: 'letter_missing', position: at + 1, expected: x[at] })
  } else {
    const i = y.findIndex((c, k) => c !== x[k])
    const at = i === -1 ? y.length - 1 : i
    if (y.filter((_, k) => k !== at).join('') === x.join('')) problems.push({ type: 'letter_extra', position: at + 1, heard: y[at] })
  }
  return problems
}

function describe(p, n, word) {
  const w = `Word ${n} «${word}»`
  switch (p.type) {
    case 'vowel':
      return p.heard
        ? `${w}: on the letter ${letterName(p.letter)} the vowel should be ${MARK_NAME[p.expected]}, but you said ${MARK_NAME[p.heard]}.`
        : `${w}: the letter ${letterName(p.letter)} needs ${MARK_NAME[p.expected]}. You left the vowel out.`
    case 'shadda':
      return `${w}: the letter ${letterName(p.letter)} is doubled (shadda). You read it once.`
    case 'shadda_extra':
      return `${w}: the letter ${letterName(p.letter)} is not doubled. You read it twice.`
    case 'letter':
      return `${w}: the ${ordinal(p.position)} letter should be ${letterName(p.expected)}, but you said ${letterName(p.heard)}.`
    case 'letter_missing':
      return `${w}: you left out the ${ordinal(p.position)} letter, ${letterName(p.expected)}.`
    case 'letter_extra':
      return `${w}: you added an extra letter, ${letterName(p.heard)}, at position ${p.position}.`
    default:
      return `${w}: ${p.type}`
  }
}

// result = output of alignRecitation(reference, heard) (NOT in conservative mode).
export function muallimFeedback(result) {
  const total = result.items.length
  if (!result.reliable) {
    return {
      verdict: 'unclear',
      headline: result.reason === 'no_speech'
        ? 'I could not hear you. Check your microphone and recite again.'
        : 'I could not follow your recitation. Recite again, a little slower and closer to the microphone.',
      corrections: [], stats: { words: total, correct: result.summary.correct },
    }
  }
  const corrections = []
  let stoppedAt = null
  result.items.forEach((it, i) => {
    const n = i + 1
    if (it.status === 'not_reached') { stoppedAt ??= n; return }
    if (it.status === 'omitted') {
      corrections.push({ word: n, type: 'skipped', reference: it.reference, message: `Word ${n} «${it.reference}»: you skipped this word.` })
      return
    }
    if (it.status === 'correct' || it.status === 'substituted' || it.status === 'uncertain') {
      const problems = it.heard ? compareWord(it.reference, it.heard) : []
      if (problems.length) {
        for (const p of problems) corrections.push({ word: n, type: p.type, reference: it.reference, heard: it.heard, message: describe(p, n, it.reference) })
        return
      }
      if (it.status === 'substituted') {
        corrections.push({ word: n, type: 'wrong_word', reference: it.reference, heard: it.heard, message: `Word ${n} «${it.reference}»: you said «${it.heard}». The word is «${it.reference}».` })
      } else if (it.status === 'uncertain') {
        corrections.push({ word: n, type: 'unclear', reference: it.reference, heard: it.heard || null, message: `Word ${n} «${it.reference}»: I did not hear it clearly. Say it again.` })
      }
    }
  })
  for (const ex of result.extras) {
    if (ex.status === 'repeated') corrections.push({ word: ex.afterIndex + 1, type: 'repeated', heard: ex.heard, message: `After word ${ex.afterIndex + 1} you repeated «${ex.heard}».` })
    else if (ex.status === 'extra') corrections.push({ word: ex.afterIndex + 1, type: 'extra', heard: ex.heard, message: `After word ${ex.afterIndex + 1} you added «${ex.heard}», which is not in the text.` })
    else corrections.push({ word: ex.afterIndex + 1, type: 'unclear', heard: ex.heard, message: `After word ${ex.afterIndex + 1} I heard «${ex.heard}». Recite it again clearly.` })
  }
  if (stoppedAt) {
    const w = result.items[stoppedAt - 1].reference
    corrections.push({ word: stoppedAt, type: 'stopped_early', reference: w, message: `You stopped before word ${stoppedAt} «${w}». Recite to the end of the passage.` })
  }
  corrections.sort((p, q) => p.word - q.word)
  const passed = corrections.length === 0
  return {
    verdict: passed ? 'passed' : 'try_again',
    headline: passed ? 'Correct. Every word was right.' : `${corrections.length} ${corrections.length === 1 ? 'thing' : 'things'} to correct. Listen to the reference recitation, then recite again.`,
    corrections,
    stats: { words: total, correct: result.items.filter((it) => it.status === 'correct' && !corrections.some((c) => c.word === it.index + 1)).length },
  }
}

export { wordKey }
