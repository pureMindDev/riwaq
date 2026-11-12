// Calendar dates are plain "YYYY-MM-DD" strings in the LEARNER's time zone.
export function isValidTimeZone(tz) {
  if (typeof tz !== 'string' || tz.length > 64) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export function todayIn(timeZone = 'UTC', now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
}

const toUtc = (s) => {
  const [y, m, d] = s.split('-').map(Number)
  return Date.UTC(y, m - 1, d)
}

export function addDays(dateStr, n) {
  return new Date(toUtc(dateStr) + n * 86400000).toISOString().slice(0, 10)
}

// Whole days from `from` to `to` (positive when `to` is later).
export const daysBetween = (from, to) => Math.round((toUtc(to) - toUtc(from)) / 86400000)
export const isDateString = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(toUtc(s))
