// BETA letter check. It compares what the BROWSER's ordinary Arabic speech recogniser heard with the letter that
// was expected. It is not a Tajweed judge: the recogniser is built for words, may confuse similar letters
// (ح/ه, ص/س, ق/ك ...), and can be wrong in both directions. A "match" means "the recogniser heard this letter",
// not "the makhraj is correct".
const MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭ࣓-ࣿـ]/g
export const FATHA = 'َ'

export const key = (text) => String(text ?? '')
  .replace(MARKS, '')
  .replace(/[آأإٱ]/g, 'ا') // alef variants -> ا
  .replace(/ى/g, 'ي') // ى -> ي
  .replace(/ة/g, 'ه') // ة -> ه
  .replace(/[^ء-ي]/g, '') // spaces, punctuation, Latin

// The letter's name in Arabic, as a recogniser would write it when the learner says "baa", "taa" ...
export const ARABIC_NAMES = {
  alif: 'ألف', ba: 'باء', ta: 'تاء', tha: 'ثاء', jim: 'جيم', hha: 'حاء', kha: 'خاء', dal: 'دال', dhal: 'ذال', ra: 'راء',
  zay: 'زاي', sin: 'سين', shin: 'شين', sad: 'صاد', dad: 'ضاد', tta: 'طاء', zha: 'ظاء', ayn: 'عين', ghayn: 'غين',
  fa: 'فاء', qaf: 'قاف', kaf: 'كاف', lam: 'لام', mim: 'ميم', nun: 'نون', ha: 'هاء', waw: 'واو', ya: 'ياء',
}

// What to say, Tajweed/Qaida style: the letter with fatha (a short "a"). Alif is taught as hamza with fatha.
export const syllableFor = (letter) => (letter.id === 'alif' ? 'أ' + FATHA : letter.char + FATHA)

// Alternatives accepted for one letter. Deliberately narrow: the bare letter, the letter + long ā (how recognisers
// usually write the syllable "ba"), or the letter's name. Anything longer is a different word, so it is a miss.
export function acceptedKeys(letter) {
  const c = key(letter.char)
  const name = key(ARABIC_NAMES[letter.id])
  const set = new Set([c, c + 'ا', name, name.replace(/ء$/, ''), name.replace(/ء$/, '') + 'ا'])
  if (letter.id === 'alif') { set.add('اا'); set.add('ءا'); set.add('ء') }
  set.delete('')
  return set
}

// alternatives: strings the recogniser offered. Returns 'none' (nothing heard), 'match' or 'miss'.
export function judgeLetter(letter, alternatives) {
  const keys = (alternatives || []).flatMap((a) => String(a ?? '').split(/\s+/)).map(key).filter(Boolean)
  if (!keys.length) return { result: 'none', heard: '' }
  const ok = acceptedKeys(letter)
  const hit = keys.find((k) => ok.has(k))
  return hit ? { result: 'match', heard: hit } : { result: 'miss', heard: keys[0] }
}
