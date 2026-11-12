// One place that turns a saved lesson record into text, so the overview, the Tahfidh page and the lesson page
// agree and never show "undefined" / "NaN". Numbers come only from saved quiz results (per lesson, never per letter).
export const attemptCount = (lesson) => (Number.isInteger(lesson?.attempts) && lesson.attempts > 0 ? lesson.attempts : 0)

export function bestScore(lesson) {
  const b = lesson?.best
  if (!b || !Number.isFinite(b.score) || !Number.isFinite(b.total) || b.total <= 0) return null
  return { score: b.score, total: b.total, percent: Math.round((b.score / b.total) * 100) }
}

export const scoreLabel = (lesson) => {
  const b = bestScore(lesson)
  return b ? `Best score: ${b.percent}% (${b.score}/${b.total})` : 'Best score: not tried yet'
}
export const attemptsLabel = (lesson) => `Attempts: ${attemptCount(lesson)}`
