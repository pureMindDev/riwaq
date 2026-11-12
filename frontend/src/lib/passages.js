export function formatRange(p) {
  const name = p.surahName || `Surah ${p.surah}`
  return p.from === p.to ? `${name} ${p.from}` : `${name} ${p.from}–${p.to}`
}

export const verseCount = (p) => p.to - p.from + 1

export function rangesOverlap(a, b) {
  return a.surah === b.surah && a.from <= b.to && b.from <= a.to
}

// Returns an error message, or null if the range is fine.
export function validateRange({ surah, from, to }, versesCount) {
  if (!Number.isInteger(surah) || surah < 1 || surah > 114) return 'Choose a Surah.'
  if (!Number.isInteger(from) || !Number.isInteger(to)) return 'Enter whole numbers for the verses.'
  if (from < 1) return 'Verse numbers start at 1.'
  if (from > to) return 'The first verse must not come after the last verse.'
  if (versesCount && to > versesCount) return `This Surah has ${versesCount} verses.`
  return null
}
