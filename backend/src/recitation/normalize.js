// Turns Arabic text into a comparison key. Removes vowel marks, Qur'anic
// annotation signs and tatweel, and unifies letter variants, so that
// "same word, different spelling convention" is not treated as a mistake.
const MARKS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D3-\u08FF\u0640]/g

export function wordKey(text) {
  return String(text)
    .replace(MARKS, '')
    .replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627') // alef variants -> ا
    .replace(/\u0649/g, '\u064A') // ى -> ي
    .replace(/\u0629/g, '\u0647') // ة -> ه
    .replace(/\u0627/g, '') // drop alef: Uthmani and plain spelling differ here
    .replace(/[^\u0621-\u064A]/g, '')
}

export function splitWords(text) {
  return String(text).split(/\s+/).filter((w) => wordKey(w).length > 0)
}

// 0..1 character-level similarity between two keys.
export function similarity(a, b) {
  if (a === b) return 1
  if (!a.length || !b.length) return 0
  const prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0]
    prev[0] = i
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j]
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1))
      diag = tmp
    }
  }
  return 1 - prev[b.length] / Math.max(a.length, b.length)
}
